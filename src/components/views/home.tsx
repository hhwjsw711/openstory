'use client';
import { useCallback, useEffect, useState, type FC } from 'react';

import scene1 from '@/assets/community/scene1.jpg';
import scene2 from '@/assets/community/scene2.jpg';
import scene3 from '@/assets/community/scene3.jpg';
import scene4 from '@/assets/community/scene4.jpg';
import scene5 from '@/assets/community/scene5.jpg';
import scene6 from '@/assets/community/scene6.jpg';
import scene7 from '@/assets/community/scene7.jpg';
import scene8 from '@/assets/community/scene8.jpg';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ScriptView } from '@/components/views/script-view';
import { Sparkles } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

const communityCreations = [
  {
    id: 1,
    image: scene1,
    title: 'Dystopian Portrait',
    creator: 'Alex Chen',
    style: 'Cinematic',
  },
  {
    id: 2,
    image: scene2,
    title: 'Natural Beauty',
    creator: 'Sarah Miller',
    style: 'Portrait',
  },
  {
    id: 3,
    image: scene3,
    title: 'Night Energy',
    creator: 'Jordan Blake',
    style: 'Candid',
  },
  {
    id: 4,
    image: scene4,
    title: 'Throne of Power',
    creator: 'Morgan Lee',
    style: 'Fantasy',
  },
  {
    id: 5,
    image: scene5,
    title: 'Fire & Steel',
    creator: 'Casey Kim',
    style: 'Action',
  },
  {
    id: 6,
    image: scene6,
    title: 'Golden Hour',
    creator: 'Riley Park',
    style: 'Portrait',
  },
  {
    id: 7,
    image: scene7,
    title: 'Mecha Rising',
    creator: 'Taylor Wu',
    style: 'Sci-Fi',
  },
  {
    id: 8,
    image: scene8,
    title: 'Stranger Things',
    creator: 'Jamie Cox',
    style: 'Retro',
  },
];

const headingPhrases = [
  'Direct Your Agents',
  'Initiate Your Story',
  'Run the Scene',
  'Activate the Crew',
  'Generate the Vision',
  'Compose the Frame',
  'Execute the Shot',
  'Build the Sequence',
  'Light the Scene',
  'Roll the Take',
  'Words Become Vision',
  'Turn Thought Into Cinema',
  'Where Scripts Start to Breathe',
  'Every Frame Begins Here',
  'Ideas in Motion',
  'From Script to Sequence',
  'Stories That Build Themselves',
  'Write It. Watch It.',
  'The Screen Awaits.',
  'See What You Imagine.',
];

export const HomeView: FC = () => {
  const router = useRouter();
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    const currentPhrase = headingPhrases[currentPhraseIndex];

    let charIndex = 0;

    if (isTyping) {
      // Typing animation
      const typingInterval = setInterval(() => {
        if (charIndex <= currentPhrase.length) {
          setDisplayedText(currentPhrase.slice(0, charIndex));
          charIndex++;
        } else {
          clearInterval(typingInterval);
          // Wait before starting to delete
          setTimeout(() => {
            setIsTyping(false);
          }, 2000);
        }
      }, 50);

      return () => clearInterval(typingInterval);
    } else {
      // Deleting animation
      const deletingInterval = setInterval(() => {
        if (charIndex < currentPhrase.length) {
          setDisplayedText(
            currentPhrase.slice(0, currentPhrase.length - charIndex)
          );
          charIndex++;
        } else {
          clearInterval(deletingInterval);
          setCurrentPhraseIndex((prev) => (prev + 1) % headingPhrases.length);
          setIsTyping(true);
        }
      }, 30);

      return () => clearInterval(deletingInterval);
    }
  }, [currentPhraseIndex, isTyping]);

  // Handle successful sequence creation
  const handleSuccess = useCallback(
    (sequenceIds: string[]) => {
      if (sequenceIds.length > 0) {
        // Navigate to storyboard page after successful generation
        router.push(`/sequences/${sequenceIds[0]}/storyboard`);
      }
    },
    [router]
  );

  return (
    <div className="relative">
      {/* Hero Section with Video Background */}
      <div className="relative w-full h-[70vh]">
        {/* Background Video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
        >
          <source src="/video/header_timeline.mp4" type="video/mp4" />
        </video>

        {/* Gradient Overlay for Readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/50 to-background z-0"></div>

        {/* Content Overlay - Positioned to overlap bottom */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center px-8 translate-y-1/4 z-10">
          <div className="w-full max-w-4xl">
            <Card>
              <CardHeader>
                <div className="text-center space-y-4">
                  <h1 className="text-4xl font-extralight tracking-wide min-h-[3rem] flex items-center justify-center">
                    <span className="inline-flex items-center">
                      {displayedText}
                      <span className="inline-block w-[2px] h-9 bg-primary ml-1 animate-pulse shadow-sm shadow-primary/50" />
                    </span>
                  </h1>
                  <div className="text-muted-foreground text-sm font-light max-w-2xl mx-auto">
                    <p>The No.1 agentic film crew for your ideas.</p>
                  </div>
                </div>
              </CardHeader>
              <ScriptView onSuccess={handleSuccess} flat />
            </Card>
          </div>
        </div>
      </div>

      {/* Community Showcase Section */}
      <section className="relative px-8 py-16 mt-84">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold text-primary uppercase tracking-wider">
                Community Creations
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              See What Creators Are Making
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Discover incredible work from our community of visual storytellers
            </p>
          </div>

          {/* Gallery Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {communityCreations.map((creation) => (
              <div
                key={creation.id}
                className="group relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer hover-scale"
              >
                <Image
                  src={creation.image}
                  alt={creation.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-sm font-bold text-foreground mb-1">
                      {creation.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      by {creation.creator}
                    </p>
                    <span className="inline-block text-[10px] font-semibold px-2 py-1 rounded-full bg-primary/20 text-primary">
                      {creation.style}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <div className="text-center">
            <Button size="lg" variant="outline" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Explore More Creations
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
