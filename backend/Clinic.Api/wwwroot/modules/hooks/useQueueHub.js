import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import { authStorage } from '../lib/api';
export function useQueueHub({ tvDeviceToken, onQueueUpdated, onPatientCalled, onDoctorBreakToggled, onResyncRequired, enabled = true, }) {
    const [connectionStatus, setConnectionStatus] = useState('DISCONNECTED');
    const hubRef = useRef(null);
    // Keep callback refs stable to avoid reconnecting on re-renders
    const callbacksRef = useRef({
        onQueueUpdated,
        onPatientCalled,
        onDoctorBreakToggled,
        onResyncRequired,
    });
    useEffect(() => {
        callbacksRef.current = {
            onQueueUpdated,
            onPatientCalled,
            onDoctorBreakToggled,
            onResyncRequired,
        };
    });
    useEffect(() => {
        if (!enabled) {
            if (hubRef.current) {
                hubRef.current.stop();
                hubRef.current = null;
                setConnectionStatus('DISCONNECTED');
            }
            return;
        }
        const isTvMode = Boolean(tvDeviceToken);
        const hubUrl = '/hubs/queue';
        const builder = new signalR.HubConnectionBuilder()
            .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
            .configureLogging(signalR.LogLevel.Warning);
        if (isTvMode) {
            builder.withUrl(`${hubUrl}?deviceToken=${encodeURIComponent(tvDeviceToken)}`);
        }
        else {
            builder.withUrl(hubUrl, {
                accessTokenFactory: () => authStorage.getToken() || '',
            });
        }
        const connection = builder.build();
        hubRef.current = connection;
        setConnectionStatus('CONNECTING');
        connection.on('QueueUpdated', (data) => {
            callbacksRef.current.onQueueUpdated?.(data);
        });
        connection.on('PatientCalled', (data) => {
            callbacksRef.current.onPatientCalled?.(data);
        });
        connection.on('DoctorBreakToggled', (data) => {
            callbacksRef.current.onDoctorBreakToggled?.(data);
        });
        connection.onreconnecting(() => {
            setConnectionStatus('RECONNECTING');
        });
        connection.onreconnected(() => {
            setConnectionStatus('CONNECTED');
            // Critical: on reconnected, resync full state to reconcile any dropped events
            callbacksRef.current.onResyncRequired?.();
        });
        connection.onclose(() => {
            setConnectionStatus('DISCONNECTED');
        });
        connection
            .start()
            .then(() => {
            setConnectionStatus('CONNECTED');
        })
            .catch((err) => {
            console.warn('QueueHub connection attempt failed (will retry or fallback to polling):', err);
            setConnectionStatus('DISCONNECTED');
        });
        return () => {
            connection.stop().catch(() => { });
            hubRef.current = null;
        };
    }, [tvDeviceToken, enabled]);
    const reconnect = useCallback(async () => {
        if (hubRef.current) {
            try {
                await hubRef.current.stop();
                await hubRef.current.start();
                setConnectionStatus('CONNECTED');
            }
            catch (e) {
                console.error('Manual reconnect failed:', e);
            }
        }
    }, []);
    return {
        connectionStatus,
        isConnected: connectionStatus === 'CONNECTED',
        reconnect,
    };
}
