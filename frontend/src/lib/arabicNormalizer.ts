export const ArabicNormalizer = {
  /**
   * Normalizes Arabic text:
   * - Unifies alef variants (أ, إ, آ, ٱ -> ا)
   * - Unifies alef-maksura to yaa (ى -> ي)
   * - Unifies taa-marbuta to haa (ة -> ه)
   * - Unifies waw with hamza (ؤ -> و)
   * - Unifies yaa with hamza (ئ -> ي)
   * - Strips tashkeel (fatha, damma, kasra, shadda, sukun, tanween, dagger alef)
   * - Strips tatweel (ـ)
   * - Converts Arabic-Indic digits (٠-٩) and Persian digits (۰-۹) to Western digits (0-9)
   * - Collapses spaces and lowercases ASCII
   */
  normalizeText(input?: string | null): string {
    if (!input || !input.trim()) return '';

    let res = '';
    for (let i = 0; i < input.length; i++) {
      const c = input[i];
      const code = c.charCodeAt(0);

      // Strip Tashkeel (0x064B - 0x0652), Tatweel (0x0640), Dagger Alef (0x0670)
      if ((code >= 0x064b && code <= 0x0652) || code === 0x0640 || code === 0x0670) {
        continue;
      }

      // Arabic-Indic digits (0x0660 - 0x0669) -> 0-9
      if (code >= 0x0660 && code <= 0x0669) {
        res += String.fromCharCode(48 + (code - 0x0660));
        continue;
      }

      // Persian digits (0x06F0 - 0x06F9) -> 0-9
      if (code >= 0x06f0 && code <= 0x06f9) {
        res += String.fromCharCode(48 + (code - 0x06f0));
        continue;
      }

      // Normalize letters
      switch (c) {
        case 'آ':
        case 'أ':
        case 'إ':
        case 'ٱ':
          res += 'ا';
          break;
        case 'ى':
          res += 'ي';
          break;
        case 'ة':
          res += 'ه';
          break;
        case 'ؤ':
          res += 'و';
          break;
        case 'ئ':
          res += 'ي';
          break;
        default:
          res += c.toLowerCase();
          break;
      }
    }

    return res.replace(/\s+/g, ' ').trim();
  },

  /**
   * Normalizes Egyptian mobile phone numbers to 11 digits starting with 01...
   */
  normalizePhone(input?: string | null): string {
    if (!input || !input.trim()) return '';

    let digits = '';
    for (let i = 0; i < input.length; i++) {
      const c = input[i];
      const code = c.charCodeAt(0);

      if (code >= 0x0660 && code <= 0x0669) {
        digits += String.fromCharCode(48 + (code - 0x0660));
      } else if (code >= 0x06f0 && code <= 0x06f9) {
        digits += String.fromCharCode(48 + (code - 0x06f0));
      } else if (c >= '0' && c <= '9') {
        digits += c;
      }
    }

    if (digits.startsWith('00201') && digits.length >= 13) {
      digits = '01' + digits.substring(5);
    } else if (digits.startsWith('201') && digits.length >= 12) {
      digits = '01' + digits.substring(3);
    } else if (digits.startsWith('1') && digits.length === 10) {
      digits = '0' + digits;
    }

    if (digits.length === 11 && digits.startsWith('01')) {
      return digits;
    }

    return '';
  },
};
