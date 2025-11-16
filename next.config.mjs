/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vkdjwwrqiorbsdjmojjq.supabase.co",
        pathname: "/storage/v1/object/public/product_images/**",
      },
    ],
  },
};

export default nextConfig;
