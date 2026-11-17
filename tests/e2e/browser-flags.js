export const webglFlags = ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'];
// Na Linuxu potřebuje i vykreslení do plátna stejný ovladač Vulkanu jako adaptér WebGPU.
const linuxWebgpuFlags = process.platform === 'linux' ? ['--use-vulkan=swiftshader', '--disable-vulkan-surface'] : [];
export const webgpuFlags = [
  ...webglFlags, '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-webgpu-adapter=swiftshader',
  ...linuxWebgpuFlags,
];
