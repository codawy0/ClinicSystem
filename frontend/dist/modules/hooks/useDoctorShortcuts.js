import { useEffect, useRef } from 'react';
export function useDoctorShortcuts({ onFocusDrugSearch, onCallNext, onComplete, onCompleteAndCallNext, onPrintPrescription, enabled = true, }) {
    const handlersRef = useRef({
        onFocusDrugSearch,
        onCallNext,
        onComplete,
        onCompleteAndCallNext,
        onPrintPrescription,
    });
    useEffect(() => {
        handlersRef.current = {
            onFocusDrugSearch,
            onCallNext,
            onComplete,
            onCompleteAndCallNext,
            onPrintPrescription,
        };
    });
    useEffect(() => {
        if (!enabled)
            return;
        const handleKeyDown = (e) => {
            // 1. F2: Focus drug search input
            if (e.key === 'F2') {
                e.preventDefault();
                handlersRef.current.onFocusDrugSearch();
                return;
            }
            // 2. F4: Call next patient
            if (e.key === 'F4' && !e.altKey) {
                e.preventDefault();
                handlersRef.current.onCallNext();
                return;
            }
            // 3. F9: Complete consultation
            if (e.key === 'F9') {
                e.preventDefault();
                handlersRef.current.onComplete();
                return;
            }
            // 4. Ctrl+Enter: Complete consultation and call next
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handlersRef.current.onCompleteAndCallNext();
                return;
            }
            // 5. Ctrl+P: Print prescription
            if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                handlersRef.current.onPrintPrescription();
                return;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled]);
}
