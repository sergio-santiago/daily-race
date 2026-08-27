/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export para servir el add-on como assets estaticos en cualquier CDN.
  // Cambiar a undefined si se prefiere SSR.
  output: 'export',
  // Si se sirve desde un subpath (ej. /meet-addon), descomentar:
  // basePath: '/meet-addon',
  trailingSlash: true,
};

export default nextConfig;
