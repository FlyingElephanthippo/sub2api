export default {
  videoGen: {
    title: 'Video Generation', description: 'Generate a video from a description or one reference image, then preview and download it here.',
    apiKey: 'API key', selectKey: 'Select a key', noKeys: 'No video-capable key is available. Create an API key assigned to a video channel first.',
    model: 'Model', selectModel: 'Select a model', loadingModels: 'Loading models…', noModels: 'This key has no video models. Ask an administrator to configure a video channel.',
    retry: 'Retry', prompt: 'Video description', promptPlaceholder: 'Describe the subject, motion, camera and surroundings…', duration: 'Requested duration', seconds: '{count} seconds',
    aspectRatio: 'Aspect ratio', landscape: 'Landscape 16:9', portrait: 'Portrait 9:16', reference: 'Reference image (optional)',
    referenceHint: 'One PNG, JPEG or WebP image, up to 10 MB.', removeReference: 'Remove image',
    referenceError: 'Choose a valid PNG, JPEG or WebP image no larger than 10 MB.',
    pricingNotice: 'Charges follow the selected channel pricing. Actual Muse duration and quality depend on the generated output.',
    generate: 'Generate video', generating: 'Generating…', result: 'Result', empty: 'Your generated video will appear here.',
    submitting: 'Submitting task…', processing: 'Generating video…', completed: 'Video completed', failed: 'Video generation failed', paused: 'Progress checking stopped',
    taskID: 'Task ID', pause: 'Stop checking progress', resume: 'Resume checking progress', pauseHint: 'Stopping progress checks does not cancel an accepted task. Generation continues when you visit another page.',
    timeout: 'Progress checking timed out. Resume checking without submitting another generation.', download: 'Download video', loadVideo: 'Load video',
    requestFailed: 'The request failed. Try again.', apiUsage: 'API usage', apiHint: 'Use the same Sub2API key to submit, check and download a video. Status and content requests require the Authorization header.',
  },
}
