# Browser-Based LLM Chat Application

A web application that runs Large Language Models (LLMs) locally in the browser. Built with SolidJS and Transformers.js, this application provides private, offline AI chat capabilities without requiring a server or GPU.

## 🚀 Live Demo

**Try it now:** [https://flexpavement.github.io/research-browser-llm/](https://flexpavement.github.io/research-browser-llm/)

The application runs entirely in your browser - no server required! On first load, it will download the LaMini-Flan-T5-783M model (~1.5GB) which will be cached for future use.

## Table of Contents

- [Research Overview](#research-overview)
- [Chosen Solution](#chosen-solution)
- [Available Options](#available-options)
- [Model Selection](#model-selection)
- [Architecture](#architecture)
- [Setup Instructions](#setup-instructions)
- [Browser Compatibility](#browser-compatibility)
- [Performance Considerations](#performance-considerations)

## Research Overview

This project explores different approaches to embedding LLM models locally in browsers, evaluating performance, compatibility, and ease of use.

## Chosen Solution

**Framework:** Transformers.js (by Hugging Face)
**Model:** LaMini-Flan-T5-783M (`Xenova/LaMini-Flan-T5-783M`)
**Web Framework:** SolidJS

### Why Transformers.js?

After evaluating multiple options, Transformers.js was selected for the following reasons:

1. **Official Support**: Maintained by Hugging Face with excellent documentation
2. **Dual Backend Support**:
   - WebGPU for high-performance GPU acceleration (up to 100× faster)
   - WebAssembly (WASM) fallback for CPU-only devices
3. **Easy Integration**: Simple API that works seamlessly with modern frameworks like Solid
4. **Wide Model Support**: Compatible with 2,000+ models from Hugging Face
5. **Active Development**: Regular updates and new model support
6. **Privacy-First**: All inference happens locally in the browser

### Why LaMini-Flan-T5-783M?

The LaMini-Flan-T5-783M model is ideal for browser deployment:

1. **Proven Stability**: Well-tested T5 architecture with excellent browser compatibility
2. **Good Performance**: 783M parameters provide quality text generation
3. **Instruction-Tuned**: Fine-tuned for following instructions and answering questions
4. **Browser-Ready**: Available in ONNX format (Xenova) optimized for web use
5. **Reliable Loading**: Works consistently with WASM backend without reload issues
6. **Wide Compatibility**: Runs on all modern browsers without GPU requirements

## Available Options

During research, three main approaches were evaluated:

### 1. WebLLM (MLC-AI)

**Description**: High-performance in-browser LLM inference engine using WebGPU.

**Pros**:
- Excellent performance (~80% of native speed)
- OpenAI API compatible
- Well-optimized compilation
- Supports major models (Llama, Phi, Gemma, Mistral, Qwen)

**Cons**:
- Requires WebGPU (no CPU fallback)
- More opinionated architecture
- Less flexible for custom implementations

**Use Case**: Best for applications that can guarantee WebGPU support and need maximum performance.

### 2. Transformers.js (Hugging Face) ✅ CHOSEN

**Description**: Official Hugging Face library for running transformer models in browsers using ONNX Runtime Web.

**Pros**:
- Official Hugging Face support
- Excellent documentation
- WebGPU + WASM dual backend
- 2,000+ compatible models
- Regular updates
- Framework-agnostic

**Cons**:
- Slightly more verbose setup than WebLLM
- Some models still being converted to ONNX

**Use Case**: Best balance of performance, compatibility, and ease of use for production applications.

### 3. ONNX Runtime Web (Direct)

**Description**: Low-level inference runtime supporting WebGPU, WebGL, WebNN, and WebAssembly.

**Pros**:
- Maximum control and flexibility
- Multiple backend options
- Can utilize NPUs on supported hardware
- Best for custom optimization

**Cons**:
- Very low-level API
- Requires significant boilerplate
- Manual model preprocessing needed
- Steeper learning curve

**Use Case**: Best for advanced users needing fine-grained control or custom architectures.

## Model Selection

### Evaluated Gemma Models

| Model | Parameters | Browser Support | ONNX Available | Recommendation |
|-------|-----------|-----------------|----------------|----------------|
| **Gemma 3 270M IT** | 270M | ✅ Yes (WebGPU + WASM) | ✅ Yes | **RECOMMENDED** |
| Gemma 3n E2B IT | 6B (runs like 2B) | 🔄 Coming Soon | ✅ Yes (Node.js only) | Future option |
| Gemma 2 2B IT | 2B | ⚠️ Partial | ✅ Yes | Fallback option |
| Gemma 2 9B IT | 9B | ❌ Too large | ✅ Yes (Desktop only) | Not recommended |

### Why Not Larger Models?

- **2B+ models**: Require significant memory (4-8GB) and may cause browser crashes
- **9B+ models**: Too large for browser deployment, better suited for desktop applications
- **270M model**: Sweet spot for browser performance, typically requires <1GB memory

## Architecture

```
┌─────────────────────────────────────────────┐
│           Browser Environment                │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │         SolidJS Frontend              │ │
│  │  - Chat Interface                      │ │
│  │  - Message History                     │ │
│  │  - Loading States                      │ │
│  └──────────────┬─────────────────────────┘ │
│                 │                            │
│  ┌──────────────▼─────────────────────────┐ │
│  │       Transformers.js Layer           │ │
│  │  - Model Loading                       │ │
│  │  - Text Generation Pipeline            │ │
│  │  - Tokenization                        │ │
│  └──────────────┬─────────────────────────┘ │
│                 │                            │
│  ┌──────────────▼─────────────────────────┐ │
│  │      ONNX Runtime Web                 │ │
│  │                                        │ │
│  │  ┌──────────┐      ┌──────────┐      │ │
│  │  │ WebGPU   │  OR  │   WASM   │      │ │
│  │  │ (Fast)   │      │ (Compat) │      │ │
│  │  └──────────┘      └──────────┘      │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Setup Instructions

### Prerequisites

- Node.js 18+ or Bun
- Modern browser with WebGPU support (Chrome 113+, Edge 113+) or WASM support (all modern browsers)

### Installation

```bash
# Install dependencies (skip CUDA for browser-only deployment)
npm install --onnxruntime-node-install-cuda=skip
# or
bun install

# Start development server
npm run dev
# or
bun dev
```

### Build for Production

```bash
npm run build
# or
bun run build
```

### Deployment

The project includes a GitHub Actions workflow that automatically deploys to GitHub Pages when changes are pushed to the main branch. The built application is available at:

**Live URL:** [https://flexpavement.github.io/research-browser-llm/](https://flexpavement.github.io/research-browser-llm/)

To enable GitHub Pages for your fork:
1. Go to repository Settings > Pages
2. Set Source to "GitHub Actions"
3. Push changes to trigger the deployment workflow

The deployment process:
- Automatically builds the application
- Optimizes assets for production
- Deploys to GitHub Pages
- Includes `.nojekyll` file to prevent Jekyll processing

## Browser Compatibility

### WebGPU Support (High Performance)

- ✅ Chrome/Edge 113+ (Windows, macOS, Linux)
- ✅ Firefox 133+ (Windows)
- 🔄 Safari (Coming soon)

### WASM Fallback (Universal Compatibility)

- ✅ All modern browsers
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ⚠️ Performance: ~5-100× slower than WebGPU

### Recommended Browsers

1. **Chrome/Edge 113+** - Best performance with WebGPU
2. **Firefox 133+** - Good performance on Windows with WebGPU
3. **Safari** - Works with WASM, WebGPU support coming

## Performance Considerations

### Model Loading

- **First Load**: 50-200MB download (cached after first use)
- **Subsequent Loads**: Instant from browser cache
- **Storage**: Uses IndexedDB for model caching

### Inference Speed

| Hardware | Backend | Tokens/sec (Approx) |
|----------|---------|---------------------|
| Modern GPU | WebGPU | 20-50 |
| Integrated GPU | WebGPU | 10-30 |
| CPU (Desktop) | WASM | 2-5 |
| CPU (Mobile) | WASM | 0.5-2 |

### Memory Usage

- **Baseline (App)**: ~100MB
- **Model (Gemma 3 270M)**: ~600-800MB
- **Runtime Overhead**: ~200MB
- **Total**: ~1GB recommended minimum RAM

### Optimization Tips

1. **Enable WebGPU**: Ensure hardware acceleration is enabled in browser settings
2. **Close Other Tabs**: Reduce memory pressure
3. **Use Production Build**: Minified code reduces overhead
4. **Preload Model**: Load model on app startup for better UX
5. **Implement Streaming**: Use text streaming for better perceived performance

## Privacy & Security

- **No Server Required**: All processing happens locally
- **No Data Transmission**: Conversations never leave the device
- **Offline Capable**: Works without internet after initial model download
- **No Tracking**: No analytics or telemetry

## Future Enhancements

- Support for Gemma 3n E2B when browser support is available
- Model switching capabilities
- Conversation history persistence
- Export/import conversations
- Custom system prompts
- Temperature and generation parameter controls

## License

MIT

## Acknowledgments

- [Hugging Face](https://huggingface.co/) for Transformers.js
- [Google](https://ai.google.dev/) for the Gemma model family
- [SolidJS](https://www.solidjs.com/) for the reactive framework
- [MLC-AI](https://mlc.ai/) for WebLLM research and inspiration

## References

- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js)
- [Gemma 3 270M Model Card](https://huggingface.co/google/gemma-3-270m-it)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
