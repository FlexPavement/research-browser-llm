import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js
// Use local models if available, otherwise download from HuggingFace
env.allowLocalModels = false;
env.useBrowserCache = true;

// Model configuration
const MODEL_NAME = 'onnx-community/gemma-3-270m-it-ONNX';
const DEVICE = 'webgpu'; // Will fallback to 'wasm' if WebGPU is not available

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
      return;
    }

    this.loading = true;
    this.error = null;
    this.progress = 0;

    try {
      // Check WebGPU support
      const hasWebGPU = await this.checkWebGPUSupport();
      const device = hasWebGPU ? 'webgpu' : 'wasm';

      console.log(`Loading model with ${device.toUpperCase()} backend...`);

      if (this.progressCallback) {
        this.progressCallback({ status: 'downloading', progress: 0, device });
      }

      // Load the text generation pipeline
      this.generator = await pipeline('text-generation', MODEL_NAME, {
        device,
        dtype: hasWebGPU ? 'fp32' : 'q8', // Use quantization for WASM
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
      this.error = error.message;
      this.loading = false;
      this.loaded = false;

      if (this.progressCallback) {
        this.progressCallback({ status: 'error', error: error.message });
      }

      throw error;
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
      // Format the prompt for instruction-tuned model
      const formattedPrompt = `<start_of_turn>user\n${prompt}<end_of_turn>\n<start_of_turn>model\n`;

      const result = await this.generator(formattedPrompt, {
        max_new_tokens: maxTokens,
        temperature,
        top_p: topP,
        repetition_penalty: repetitionPenalty,
        do_sample: true,
        return_full_text: false,
        callback_function: callback,
      });

      // Extract just the generated text
      let generated = result[0].generated_text;

      // Remove the end token if present
      if (generated.includes('<end_of_turn>')) {
        generated = generated.split('<end_of_turn>')[0];
      }

      return generated.trim();
    } catch (error) {
      console.error('Error generating text:', error);
      throw error;
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
      // Format the prompt for instruction-tuned model
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
