import React from 'react';
import Head from 'expo-router/head';
import { SEO, SITE_URL } from '@/constants/config';
import { SITE_NAME } from '@/lib/site';

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
  imageHeight,
  twitterCard = 'summary_large_image',
}: PageHeadProps) {
  // Default: the static brand card (no vote reads). Callers passing a /api/card image are 1200x628.
  const ogImage = imageUrl ?? `${SITE_URL}/api/og`;
  const ogHeight = imageHeight ?? (imageUrl ? 628 : 630);

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={canonicalUrl} />
      <link rel="icon" href={`${SITE_URL}/favicon.ico`} />
      <link rel="apple-touch-icon" href={`${SITE_URL}/apple-touch-icon.png`} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content={String(imageWidth)} />
      <meta property="og:image:height" content={String(ogHeight)} />
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
