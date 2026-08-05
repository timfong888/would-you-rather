import React from 'react';
import Head from 'expo-router/head';
import { SEO } from '@/constants/config';

interface PageHeadProps {
  title: string;
  description: string;
  canonicalUrl: string;
  twitterCard?: 'summary' | 'summary_large_image';
}

export default function PageHead({
  title,
  description,
  canonicalUrl,
  twitterCard = 'summary',
}: PageHeadProps) {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:site" content={SEO.twitterHandle} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Head>
  );
}
