import { WHATSAPP_NUMBER, whatsappLink } from './contact.config';

describe('whatsappLink', () => {
  it('returns a wa.me link with the encoded title, or null when no number is configured', () => {
    const link = whatsappLink('Noche & Día');
    if (WHATSAPP_NUMBER) {
      expect(link).not.toBeNull();
      expect(link!.startsWith('https://wa.me/')).toBe(true);
      expect(link).toContain(encodeURIComponent('Noche & Día'));
    } else {
      expect(link).toBeNull();
    }
  });
});
