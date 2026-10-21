import { BRAND } from './brand.config';
import {
  WHATSAPP_NUMBER,
  whatsappCommissionLink,
  whatsappGeneralLink,
  whatsappLink,
} from './contact.config';

// Las pruebas no dependen del número real: se comprueban ambos casos
function expectLink(link: string | null, message: string): void {
  if (WHATSAPP_NUMBER) {
    expect(link).not.toBeNull();
    expect(link!.startsWith('https://wa.me/')).toBe(true);
    expect(link).toContain(encodeURIComponent(message));
  } else {
    expect(link).toBeNull();
  }
}

describe('whatsappLink', () => {
  it('reads the number from the brand config', () => {
    expect(WHATSAPP_NUMBER).toBe(BRAND.whatsappNumber);
  });

  it('includes the number, the encoded title and the absolute artwork URL, or is null without number', () => {
    const link = whatsappLink('Noche & Día', 'noche-y-dia');
    if (!WHATSAPP_NUMBER) {
      expect(link).toBeNull();
      return;
    }
    expect(link!.startsWith(`https://wa.me/${WHATSAPP_NUMBER}?text=`)).toBe(true);
    expect(link).toContain(encodeURIComponent('Noche & Día'));
    expect(link).toContain(encodeURIComponent(`${BRAND.siteUrl}/obras/noche-y-dia`));
  });

  it('encodes accents, quotes and ñ so the text survives a round trip', () => {
    const title = 'El niño "Ñandú" y la canción';
    const link = whatsappLink(title, 'nino-nandu');
    if (!WHATSAPP_NUMBER) {
      expect(link).toBeNull();
      return;
    }
    const text = decodeURIComponent(new URL(link!).searchParams.get('text')!);
    expect(text).toContain(`«${title}»`);
    expect(text).toContain(`${BRAND.siteUrl}/obras/nino-nandu`);
    expect(link).not.toMatch(/["ñÑó ]/);
  });
});

describe('whatsappGeneralLink', () => {
  it('returns a wa.me link with the encoded message, or null when no number is configured', () => {
    expectLink(whatsappGeneralLink(), `Hola, quisiera consultar sobre la galería ${BRAND.name}.`);
  });
});

describe('whatsappCommissionLink', () => {
  it('returns a wa.me link with the encoded message, or null when no number is configured', () => {
    expectLink(
      whatsappCommissionLink(),
      'Hola, me gustaría encargar una obra. ¿Podemos conversar?',
    );
  });
});
