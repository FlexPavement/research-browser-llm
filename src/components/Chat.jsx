import { createSignal, For, Show, onMount } from 'solid-js';
import modelManager from '../lib/model';

export default function Chat() {
  const [messages, setMessages] = createSignal([]);
  const [input, setInput] = createSignal('');
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [modelState, setModelState] = createSignal({
    loading: false,
    loaded: false,
    error: null,
    progress: 0,
  });
  const [loadProgress, setLoadProgress] = createSignal({
    status: 'idle',
    progress: 0,
    device: null,
  });

  let messagesEndRef;

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load model on mount
  onMount(async () => {
    // Set up progress callback
    modelManager.setProgressCallback((progress) => {
      setLoadProgress(progress);
      setModelState(modelManager.getState());
    });

    // Load the model
    try {
      await modelManager.loadModel();
      setModelState(modelManager.getState());
    } catch (error) {
      console.error('Failed to load model:', error);
    }
  });

  const sendMessage = async () => {
    const userMessage = input().trim();
    if (!userMessage || isGenerating()) return;

    // Add user message
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setIsGenerating(true);

    // Add placeholder for assistant message
    const assistantIndex = messages().length + 1;
    setMessages((prev) => [...prev, { role: 'assistant', content: '', loading: true }]);

    setTimeout(scrollToBottom, 100);

    try {
      // Generate response
      const response = await modelManager.generate(userMessage, {
        maxTokens: 256,
        temperature: 0.7,
        topP: 0.9,
      });

      // Update assistant message
      setMessages((prev) =>
        prev.map((msg, idx) =>
          idx === assistantIndex ? { role: 'assistant', content: response, loading: false } : msg
        )
      );

      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error generating response:', error);
      setMessages((prev) =>
        prev.map((msg, idx) =>
          idx === assistantIndex
            ? { role: 'assistant', content: `Error: ${error.message}`, loading: false, error: true }
            : msg
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <div class="chat-container">
      <header class="chat-header">
        <div class="header-content">
          <h1>Browser LLM Chat</h1>
          <div class="header-info">
            <Show when={modelState().loaded}>
              <span class="status-badge status-ready">
                {loadProgress().device === 'webgpu' ? '🚀 WebGPU' : '🔧 CPU (WASM)'}
              </span>
            </Show>
            <Show when={modelState().loading}>
              <span class="status-badge status-loading">Loading...</span>
            </Show>
          </div>
        </div>
        <Show when={messages().length > 0}>
          <button class="btn btn-secondary" onClick={clearMessages}>
            Clear Chat
          </button>
        </Show>
      </header>

      {/* Loading state */}
      <Show when={modelState().loading}>
        <div class="loading-container">
          <div class="loading-content">
            <div class="spinner"></div>
            <h2>Loading Gemma 3 270M Model</h2>
            <p class="loading-status">
              {loadProgress().status === 'downloading' && 'Downloading model files...'}
              {loadProgress().status === 'loading' && 'Initializing model...'}
            </p>
            <div class="progress-bar">
              <div class="progress-fill" style={{ width: `${loadProgress().progress}%` }}></div>
            </div>
            <p class="progress-text">{loadProgress().progress}%</p>
            <Show when={loadProgress().device}>
              <p class="device-info">
                Backend: {loadProgress().device === 'webgpu' ? 'WebGPU (GPU Accelerated)' : 'WebAssembly (CPU)'}
              </p>
            </Show>
            <p class="loading-note">This may take a minute on first load. The model will be cached for future use.</p>
          </div>
        </div>
      </Show>

      {/* Error state */}
      <Show when={modelState().error}>
        <div class="error-container">
          <h2>Error Loading Model</h2>
          <p>{modelState().error}</p>
          <button class="btn btn-primary" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </Show>

      {/* Chat interface */}
      <Show when={modelState().loaded}>
        <div class="messages-container">
          <Show when={messages().length === 0}>
            <div class="welcome-message">
              <h2>Welcome to Browser LLM Chat!</h2>
              <p>This chat application runs entirely in your browser using the Gemma 3 270M model.</p>
              <div class="features">
                <div class="feature">
                  <span class="feature-icon">🔒</span>
                  <span>100% Private - Nothing leaves your device</span>
                </div>
                <div class="feature">
                  <span class="feature-icon">⚡</span>
                  <span>Fast inference with {loadProgress().device === 'webgpu' ? 'GPU acceleration' : 'CPU'}</span>
                </div>
                <div class="feature">
                  <span class="feature-icon">🌐</span>
                  <span>Works offline after initial load</span>
                </div>
              </div>
              <p class="start-prompt">Ask me anything to get started!</p>
            </div>
          </Show>

          <For each={messages()}>
            {(message) => (
              <div class={`message message-${message.role}`}>
                <div class="message-avatar">{message.role === 'user' ? '👤' : '🤖'}</div>
                <div class="message-content">
                  <div class="message-role">{message.role === 'user' ? 'You' : 'Gemma'}</div>
                  <Show when={message.loading}>
                    <div class="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </Show>
                  <Show when={!message.loading}>
                    <div class={message.error ? 'message-text error' : 'message-text'}>{message.content}</div>
                  </Show>
                </div>
              </div>
            )}
          </For>
          <div ref={messagesEndRef}></div>
        </div>

        <div class="input-container">
          <textarea
            class="message-input"
            placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
            value={input()}
            onInput={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isGenerating()}
            rows="1"
          />
          <button
            class="btn btn-primary send-button"
            onClick={sendMessage}
            disabled={!input().trim() || isGenerating()}
          >
            {isGenerating() ? '...' : 'Send'}
          </button>
        </div>
      </Show>
    </div>
  );
}
