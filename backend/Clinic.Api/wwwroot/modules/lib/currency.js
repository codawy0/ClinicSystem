/**
 * Currency Formatter for Clinic System
 * MANDATORY RULE (DEC-001): All monetary values are represented as integer Piastres (1 EGP = 100 Piastres).
 * Storage and calculations never use floating point numbers.
 */
export function formatEgp(piastres) {
    if (piastres == null || isNaN(piastres))
        return '0.00 ج.م';
    const egp = piastres / 100;
    return egp.toLocaleString('ar-EG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }) + ' ج.م';
}
export function parseEgpToPiastres(egp) {
    if (!egp && egp !== 0)
        return 0;
    const num = typeof egp === 'string' ? parseFloat(egp.replace(/[^\d.-]/g, '')) : egp;
    if (isNaN(num))
        return 0;
    return Math.round(num * 100);
}
export function piastresToEgpNumber(piastres) {
    if (!piastres)
        return 0;
    return piastres / 100;
}
