import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { DynamicHome } from '@/components/home/dynamic-home';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <DynamicHome />
      </main>
      <Footer />
    </>
  );
}
