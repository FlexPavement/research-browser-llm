import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js
// Use local models if available, otherwise download from HuggingFace
env.allowLocalModels = false;
env.useBrowserCache = true;

// Model configuration
// Using Xenova/LaMini-Flan-T5-783M - a smaller, browser-tested model
const MODEL_NAME = 'Xenova/LaMini-Flan-T5-783M';
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

      console.log(`Loading model with ${device.toUpperCase()} backend...`);

      if (this.progressCallback) {
        this.progressCallback({ status: 'downloading', progress: 0, device });
      }

      // Load the text generation pipeline
      this.generator = await pipeline('text2text-generation', MODEL_NAME, {
        device,
        dtype: 'fp32',
        progress_callback: (progress) => {
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
            if (this.progressCallback) {
              this.progressCallback({ status: 'loading', progress: 100, device });
            }
          }
        },
      });

      this.loaded = true;
      this.loading = false;
      console.log('Model loaded successfully!');

      if (this.progressCallback) {
        this.progressCallback({ status: 'ready', progress: 100, device });
      }
    } catch (error) {
      console.error('Error loading model:', error);

      // Create a detailed error message
      let errorMessage = 'Failed to load model';

      if (error.message.includes('fetch')) {
        errorMessage = 'Network error: Unable to download model files. Please check your internet connection.';
      } else if (error.message.includes('CORS')) {
        errorMessage = 'CORS error: Unable to access model files. This may be a browser security restriction.';
      } else if (error.message.includes('memory') || error.message.includes('allocation')) {
        errorMessage = 'Memory error: Not enough memory to load the model. Try closing other tabs.';
      } else if (error.message.includes('WebAssembly')) {
        errorMessage = 'WebAssembly error: Your browser may not support the required features.';
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
   * Generate text based on a prompt
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
    } = options;

    try {
      // T5 models work with direct prompts
      const result = await this.generator(prompt, {
        max_new_tokens: maxTokens,
        temperature,
        top_p: topP,
        repetition_penalty: repetitionPenalty,
        do_sample: true,
        callback_function: callback,
      });

      // Extract just the generated text
      const generated = result[0].generated_text;

      return generated.trim();
    } catch (error) {
      console.error('Error generating text:', error);

      // Create user-friendly error message
      let errorMessage = 'Failed to generate response';

      if (error.message.includes('memory') || error.message.includes('allocation')) {
        errorMessage = 'Memory error during generation. Try a shorter prompt or refresh the page.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Generation timed out. Please try again with a shorter prompt.';
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
      // T5 models work with direct prompts
      let previousOutput = '';

      const result = await this.generator(prompt, {
        max_new_tokens: maxTokens,
        temperature,
        top_p: topP,
        repetition_penalty: repetitionPenalty,
        do_sample: true,
        callback_function: (output) => {
          const newText = output[0].generated_text;
          const delta = newText.slice(previousOutput.length);
          previousOutput = newText;
          return { delta, full: newText };
        },
      });

      // Yield the full result
      const generated = result[0].generated_text;
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
