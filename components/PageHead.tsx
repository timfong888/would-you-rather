import React from 'react';
import Head from 'expo-router/head';
import { SEO, SITE_URL } from '@/constants/config';

interface PageHeadProps {
  title: string;
  description: string;
  canonicalUrl: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  twitterCard?: 'summary' | 'summary_large_image';
}

export default function PageHead({
  title,
  description,
  canonicalUrl,
  imageUrl,
  imageWidth = 1200,
  imageHeight = 628,
  twitterCard = 'summary_large_image',
}: PageHeadProps) {
  const ogImage = imageUrl ?? `${SITE_URL}/api/card?id=hl-1&ratio=1.91x1`;

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={canonicalUrl} />
      <link rel="apple-touch-icon" href={`${SITE_URL}/apple-touch-icon.png`} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content="Would You Rather" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content={String(imageWidth)} />
      <meta property="og:image:height" content={String(imageHeight)} />
      <meta property="og:image:type" content="image/png" />
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:site" content={SEO.twitterHandle} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={title} />
    </Head>
  );
}
