export const webglFlags = ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'];
export const webgpuFlags = [
  ...webglFlags, '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-webgpu-adapter=swiftshader',
];
