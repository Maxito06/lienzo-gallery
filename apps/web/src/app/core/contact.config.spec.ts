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
  it('returns a wa.me link with the encoded title, or null when no number is configured', () => {
    expect(whatsappLink('Noche & Día') === null).toBe(!WHATSAPP_NUMBER);
    if (WHATSAPP_NUMBER) {
      expect(whatsappLink('Noche & Día')!.startsWith('https://wa.me/')).toBe(true);
      expect(whatsappLink('Noche & Día')).toContain(encodeURIComponent('Noche & Día'));
    }
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
