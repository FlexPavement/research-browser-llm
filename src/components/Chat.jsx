import { createSignal, For, Show, onMount, createEffect } from 'solid-js';
import modelManager from '../lib/model';

export default function Chat() {
  const [messages, setMessages] = createSignal([]);
  const [input, setInput] = createSignal('');
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [generationStartTime, setGenerationStartTime] = createSignal(null);
  const [elapsedTime, setElapsedTime] = createSignal(0);
  const [generationStatus, setGenerationStatus] = createSignal('');
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
  const [loadingAttempted, setLoadingAttempted] = createSignal(false);

  let messagesEndRef;
  let timerInterval = null;

  // Update elapsed time during generation
  createEffect(() => {
    if (isGenerating() && generationStartTime()) {
      // Clear any existing interval
      if (timerInterval) clearInterval(timerInterval);

      // Update elapsed time every 100ms
      timerInterval = setInterval(() => {
        const elapsed = (Date.now() - generationStartTime()) / 1000;
        setElapsedTime(elapsed);

        // Update status messages based on elapsed time
        if (elapsed < 3) {
          setGenerationStatus('Generating response...');
        } else if (elapsed < 10) {
          setGenerationStatus('Processing... this may take a moment');
        } else if (elapsed < 30) {
          setGenerationStatus('This is taking longer than usual...');
        } else {
          setGenerationStatus('Still working... the model may be slow or stuck');
        }
      }, 100);
    } else {
      // Clear interval when not generating
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }
  });

  // Debug: Log when modelState changes
  createEffect(() => {
    console.log('[Chat] modelState changed:', modelState());
  });

  // Debug: Log when loadProgress changes
  createEffect(() => {
    console.log('[Chat] loadProgress changed:', loadProgress());
  });

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load model on mount
  onMount(async () => {
    console.log('[Chat] onMount called, loadingAttempted:', loadingAttempted());

    // Prevent multiple loading attempts using signal
    if (loadingAttempted()) {
      console.log('[Chat] Loading already attempted, skipping...');
      return;
    }

    setLoadingAttempted(true);
    console.log('[Chat] Starting model load...');

    // Set initial loading state
    setModelState({ loading: true, loaded: false, error: null, progress: 0 });

    // Set up progress callback - only update progress, not full state
    modelManager.setProgressCallback((progress) => {
      console.log('[Chat] Progress callback:', progress);
      setLoadProgress(progress);
    });

    // Load the model
    try {
      console.log('[Chat] Calling modelManager.loadModel()...');
      await modelManager.loadModel();
      console.log('[Chat] Model loaded successfully!');

      // Update the final state after loading completes
      const finalState = modelManager.getState();
      console.log('[Chat] Final state:', finalState);
      setModelState(finalState);
    } catch (error) {
      console.error('[Chat] Failed to load model:', error);
      const errorState = modelManager.getState();
      console.log('[Chat] Error state:', errorState);
      setModelState(errorState);
    }
  });

  const sendMessage = async () => {
    const userMessage = input().trim();
    if (!userMessage || isGenerating()) return;

    // Add user message
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setInput('');

    // Start generation tracking
    setIsGenerating(true);
    setGenerationStartTime(Date.now());
    setElapsedTime(0);
    setGenerationStatus('Generating response...');

    // Add placeholder for assistant message and get its index
    let assistantIndex;
    setMessages((prev) => {
      assistantIndex = prev.length; // Get index before adding
      return [...prev, { role: 'assistant', content: '', loading: true }];
    });

    console.log('[Chat] Assistant message index:', assistantIndex);

    setTimeout(scrollToBottom, 100);

    try {
      console.log('[Chat] Starting text generation...');

      // Generate response
      const response = await modelManager.generate(userMessage, {
        maxTokens: 256,
        temperature: 0.7,
        topP: 0.9,
      });

      console.log('[Chat] Text generation completed, response length:', response.length);
      console.log('[Chat] Updating message at index:', assistantIndex);

      // Update assistant message
      setMessages((prev) => {
        console.log('[Chat] Current messages length:', prev.length);
        return prev.map((msg, idx) => {
          if (idx === assistantIndex) {
            console.log('[Chat] Updating message at index', idx, 'with response');
            return { role: 'assistant', content: response, loading: false };
          }
          return msg;
        });
      });

      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('[Chat] Error generating response:', error);

      // Create a user-friendly error message
      const errorContent = error.message || 'An unexpected error occurred while generating the response.';

      setMessages((prev) =>
        prev.map((msg, idx) =>
          idx === assistantIndex
            ? {
                role: 'assistant',
                content: `⚠️ ${errorContent}\n\nPlease try:\n• Rephrasing your question\n• Using a shorter prompt\n• Refreshing the page if errors persist`,
                loading: false,
                error: true,
              }
            : msg
        )
      );

      setTimeout(scrollToBottom, 100);
    } finally {
      // Clear generation tracking
      setIsGenerating(false);
      setGenerationStartTime(null);
      setElapsedTime(0);
      setGenerationStatus('');
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
          <div class="error-icon">⚠️</div>
          <h2>Failed to Load Model</h2>
          <div class="error-message">
            <p class="error-primary">{modelState().error}</p>
            <Show when={loadProgress().error && loadProgress().error !== modelState().error}>
              <p class="error-details">{loadProgress().error}</p>
            </Show>
          </div>
          <div class="error-actions">
            <button class="btn btn-primary" onClick={() => window.location.reload()}>
              Retry Loading Model
            </button>
          </div>
          <div class="error-help">
            <p class="error-help-title">Troubleshooting:</p>
            <ul class="error-help-list">
              <li>Check your internet connection</li>
              <li>Try using a different browser (Chrome or Edge recommended)</li>
              <li>Clear your browser cache and reload</li>
              <li>Ensure you have at least 2GB of free RAM</li>
            </ul>
          </div>
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
                    <div class="generation-status">
                      <div class="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <div class="generation-info">
                        <div class="generation-status-text">{generationStatus()}</div>
                        <div class="generation-timer">
                          Elapsed: {elapsedTime().toFixed(1)}s
                          <Show when={elapsedTime() > 30}>
                            <span class="warning-text"> - Consider refreshing if stuck</span>
                          </Show>
                        </div>
                      </div>
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
