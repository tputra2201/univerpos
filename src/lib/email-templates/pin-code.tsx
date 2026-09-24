import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  storeName?: string
  userName?: string
  pin?: string
  temporary?: boolean
}

const PinEmail = ({ storeName = 'Store', userName = 'Pengguna', pin = '------', temporary = true }: Props) => (
  <Html lang="id" dir="ltr">
    <Head />
    <Preview>{`PIN ${temporary ? 'sementara' : 'default'} kasir ${storeName}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{storeName}</Heading>
        <Text style={text}>Halo {userName},</Text>
        <Text style={text}>PIN {temporary ? 'sementara' : 'default'} Anda untuk masuk ke kasir adalah:</Text>
        <Section style={pinBox}><Text style={pinText}>{pin}</Text></Section>
        <Text style={text}>Gunakan PIN ini untuk masuk, lalu Anda akan diminta membuat PIN baru. Jangan berikan PIN ini kepada siapa pun.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PinEmail,
  subject: (d: Record<string, any>) => `PIN ${d['temporary'] === false ? 'default' : 'sementara'} ${d['storeName'] ?? 'kasir'}`,
  displayName: 'PIN kasir',
  previewData: { storeName: 'Kopi Senja', userName: 'Budi', pin: '482913', temporary: true },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px' }
const h1 = { fontSize: '22px', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '22px' }
const pinBox = { backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '8px', textAlign: 'center' as const, margin: '16px 0' }
const pinText = { fontSize: '32px', letterSpacing: '8px', fontWeight: 700, color: '#111827', margin: 0 }
