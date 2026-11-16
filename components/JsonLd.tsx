import React from 'react';
import Head from 'expo-router/head';
import { serializeJsonLd, type JsonLd as JsonLdData } from '@/lib/seo';

/**
 * Emits one <script type="application/ld+json"> into the document head. In the
 * static web export the script is part of the page's HTML; in the client it is
 * applied by react-helmet like the rest of PageHead's tags.
 */
export default function JsonLd({ data }: { data: JsonLdData }) {
  return (
    <Head>
      <script type="application/ld+json">{serializeJsonLd(data)}</script>
    </Head>
  );
}
