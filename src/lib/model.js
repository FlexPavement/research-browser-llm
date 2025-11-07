import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js
// Use local models if available, otherwise download from HuggingFace
env.allowLocalModels = false;
env.useBrowserCache = true;

// Model configuration
// Using Gemma 3 270M - testing for error diagnosis
const MODEL_NAME = 'onnx-community/gemma-3-270m-it-ONNX';
const DEVICE = 'wasm'; // Use WASM for better stability

class ModelManager {
  constructor() {
    this.generator = null;
    this.loading = false;
    this.loaded = false;
    this.error = null;
    this.progress = 0;
    this.progressCallback = null;
  }

  /**
   * Check if WebGPU is available in the current browser
   */
  async checkWebGPUSupport() {
    if (!navigator.gpu) {
      return false;
    }
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return adapter !== null;
    } catch (e) {
      return false;
    }
  }

  /**
   * Set a callback for progress updates during model loading
   */
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  /**
   * Load the model
   */
  async loadModel() {
    if (this.loaded || this.loading) {
      console.log('Model already loaded or loading, skipping...');
      return;
    }

    this.loading = true;
    this.error = null;
    this.progress = 0;

    try {
      // Check WebGPU support
      const hasWebGPU = await this.checkWebGPUSupport();

      // Start with WASM for better stability, WebGPU can be enabled later
      const device = 'wasm';

      console.log(`[ModelManager] Loading model with ${device.toUpperCase()} backend...`);
      console.log('[ModelManager] Model name:', MODEL_NAME);

      if (this.progressCallback) {
        this.progressCallback({ status: 'downloading', progress: 0, device });
      }

      // Load the text generation pipeline with timeout (5 minutes for initial load)
      const loadTimeout = 300000;
      const pipelinePromise = pipeline('text-generation', MODEL_NAME, {
        device,
        dtype: 'fp32',
        progress_callback: (progress) => {
          console.log('[ModelManager] Pipeline progress:', progress);

          if (progress.status === 'progress') {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            this.progress = percent;
            if (this.progressCallback) {
              this.progressCallback({
                status: 'downloading',
                progress: percent,
                file: progress.file,
                loaded: progress.loaded,
                total: progress.total,
                device,
              });
            }
          } else if (progress.status === 'done') {
            console.log('[ModelManager] Download done for file:', progress.file);
            if (this.progressCallback) {
              this.progressCallback({ status: 'loading', progress: 100, device });
            }
          } else if (progress.status === 'initiate') {
            console.log('[ModelManager] Initiating download for:', progress.file);
          }
        },
      });

      // Race with timeout
      this.generator = await Promise.race([
        pipelinePromise,
        this.createTimeout(loadTimeout, 'Model loading'),
      ]);

      this.loaded = true;
      this.loading = false;
      console.log('[ModelManager] Model loaded successfully!');

      if (this.progressCallback) {
        this.progressCallback({ status: 'ready', progress: 100, device });
      }
    } catch (error) {
      console.error('[ModelManager] Error loading model:', error);
      console.error('[ModelManager] Error type:', error.constructor.name);
      console.error('[ModelManager] Error message:', error.message);
      console.error('[ModelManager] Error stack:', error.stack);

      // Create a detailed error message based on exception type and message
      let errorMessage = 'Failed to load model';

      if (error.message.includes('timed out')) {
        errorMessage = 'Model loading timed out after 5 minutes. Your connection may be slow, or the model files are too large. Please try again.';
      } else if (error.message.includes('404') || error.message.includes('Not Found')) {
        errorMessage = 'Model files not found. The model repository may not exist or files are missing.';
      } else if (error.message.includes('fetch') || error.message.includes('network') || error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error: Unable to download model files. Please check your internet connection and try again.';
      } else if (error.message.includes('CORS') || error.message.includes('Cross-Origin')) {
        errorMessage = 'CORS error: Unable to access model files. This may be a browser security restriction.';
      } else if (error.message.includes('memory') || error.message.includes('allocation') || error.message.includes('out of memory')) {
        errorMessage = 'Memory error: Not enough memory to load the model. Try closing other tabs and refreshing the page.';
      } else if (error.message.includes('WebAssembly') || error.message.includes('wasm')) {
        errorMessage = 'WebAssembly error: Your browser may not support the required features, or there is a compatibility issue.';
      } else if (error.name === 'TypeError') {
        errorMessage = `Type error during model loading: ${error.message}. This may indicate a model compatibility issue.`;
      } else if (error.name === 'ReferenceError') {
        errorMessage = `Reference error: ${error.message}. A required component may be missing.`;
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }

      this.error = errorMessage;
      this.loading = false;
      this.loaded = false;

      if (this.progressCallback) {
        this.progressCallback({
          status: 'error',
          error: errorMessage,
          details: error.stack
        });
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Create a timeout promise that rejects after specified milliseconds
   */
  createTimeout(ms, operation = 'Operation') {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operation} timed out after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Generate text based on a prompt with timeout
   */
  async generate(prompt, options = {}) {
    if (!this.loaded) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    const {
      maxTokens = 256,
      temperature = 0.7,
      topP = 0.9,
      repetitionPenalty = 1.1,
      callback = null,
      timeout = 60000, // 60 second timeout by default
    } = options;

    try {
      // Format the prompt for Gemma instruction-tuned model
      const formattedPrompt = `<start_of_turn>user\n${prompt}<end_of_turn>\n<start_of_turn>model\n`;

      console.log('[ModelManager] Starting generation with timeout:', timeout);

      // Create the generation promise
      const generationPromise = this.generator(formattedPrompt, {
        max_new_tokens: maxTokens,
        temperature,
        top_p: topP,
        repetition_penalty: repetitionPenalty,
        do_sample: true,
        return_full_text: false,
        callback_function: callback,
      });

      // Race between generation and timeout
      const result = await Promise.race([
        generationPromise,
        this.createTimeout(timeout, 'Text generation'),
      ]);

      console.log('[ModelManager] Generation completed successfully');

      // Extract just the generated text
      let generated = result[0].generated_text;

      // Remove the end token if present
      if (generated.includes('<end_of_turn>')) {
        generated = generated.split('<end_of_turn>')[0];
      }

      return generated.trim();
    } catch (error) {
      console.error('[ModelManager] Error generating text:', error);
      console.error('[ModelManager] Error name:', error.name);
      console.error('[ModelManager] Error stack:', error.stack);

      // Create user-friendly error message based on error type
      let errorMessage = 'Failed to generate response';

      if (error.message.includes('timed out')) {
        errorMessage = `Generation timed out after ${timeout / 1000} seconds. The model may be stuck or too slow. Try a shorter prompt or refresh the page.`;
      } else if (error.name === 'TypeError' && error.message.includes('undefined')) {
        errorMessage = 'Model initialization error. The model may not have loaded correctly. Please refresh the page.';
      } else if (error.message.includes('memory') || error.message.includes('allocation') || error.message.includes('out of memory')) {
        errorMessage = 'Memory error during generation. Try closing other tabs, using a shorter prompt, or refreshing the page.';
      } else if (error.message.includes('abort')) {
        errorMessage = 'Generation was aborted. Please try again.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error during generation. Check your connection and try again.';
      } else if (error.message.includes('WebAssembly') || error.message.includes('wasm')) {
        errorMessage = 'WebAssembly error. Your browser may not support the required features, or the model may be corrupted.';
      } else if (error.message) {
        errorMessage = `Generation error: ${error.message}`;
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Generate text with streaming support
   */
  async *generateStream(prompt, options = {}) {
    if (!this.loaded) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    const {
      maxTokens = 256,
      temperature = 0.7,
      topP = 0.9,
      repetitionPenalty = 1.1,
    } = options;

    try {
      // Format the prompt for Gemma instruction-tuned model
      const formattedPrompt = `<start_of_turn>user\n${prompt}<end_of_turn>\n<start_of_turn>model\n`;

      let previousOutput = '';

      const result = await this.generator(formattedPrompt, {
        max_new_tokens: maxTokens,
        temperature,
        top_p: topP,
        repetition_penalty: repetitionPenalty,
        do_sample: true,
        return_full_text: false,
        callback_function: (output) => {
          const newText = output[0].generated_text;
          const delta = newText.slice(previousOutput.length);
          previousOutput = newText;
          return { delta, full: newText };
        },
      });

      // Yield the full result
      let generated = result[0].generated_text;

      // Remove the end token if present
      if (generated.includes('<end_of_turn>')) {
        generated = generated.split('<end_of_turn>')[0];
      }

      yield generated.trim();
    } catch (error) {
      console.error('Error generating text:', error);
      throw error;
    }
  }

  /**
   * Unload the model to free up memory
   */
  async unload() {
    if (this.generator) {
      // Dispose of the model
      this.generator = null;
      this.loaded = false;
      this.loading = false;
      console.log('Model unloaded');
    }
  }

  /**
   * Get the current state of the model
   */
  getState() {
    return {
      loading: this.loading,
      loaded: this.loaded,
      error: this.error,
      progress: this.progress,
    };
  }
}

// Create a singleton instance
const modelManager = new ModelManager();

export default modelManager;
