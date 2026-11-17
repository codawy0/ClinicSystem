import { authStorage, ApiException } from '../lib/api';
async function uploadCsv(endpoint, file) {
    const token = authStorage.getToken();
    const formData = new FormData();
    formData.append('file', file);
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const url = endpoint.startsWith('http')
        ? endpoint
        : endpoint.startsWith('/api')
            ? endpoint
            : `/api${endpoint}`;
    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers,
            body: formData,
        });
    }
    catch {
        throw new ApiException(0, 'NETWORK_ERROR', 'تعذر الاتصال بالخادم لتحميل الملف');
    }
    if (!response.ok) {
        let errData = {};
        try {
            errData = await response.json();
        }
        catch { }
        throw new ApiException(response.status, errData.errorCode || errData.code || 'IMPORT_FAILED', errData.detail || errData.message || 'فشل معالجة ملف البيانات', errData);
    }
    return response.json();
}
export const importService = {
    async previewPatientImport(file) {
        return uploadCsv('/import/patients?dryRun=true', file);
    },
    async commitPatientImport(file) {
        return uploadCsv('/import/patients?dryRun=false', file);
    },
    async previewDrugImport(file) {
        return uploadCsv('/import/drugs?dryRun=true', file);
    },
    async commitDrugImport(file) {
        return uploadCsv('/import/drugs?dryRun=false', file);
    },
    uploadCsv,
};
