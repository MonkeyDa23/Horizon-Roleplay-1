// src/components/ErrorBoundary.tsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
    // FIX: Initialize state as a class property. This is a more modern syntax
    // and can resolve issues where TypeScript doesn't correctly infer the type of `this`
    // inside the constructor. This fixes errors related to `this.state`, `this.setState`,
    // and `this.props` being undefined on the component type.
    public state: State = { hasError: false, error: null, errorInfo: null };

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error: error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.setState({ error: error, errorInfo: errorInfo });
        console.error("Caught by Error Boundary:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    width: '100vw',
                    backgroundColor: '#0a0f18',
                    color: '#e5e7eb',
                    fontFamily: 'monospace',
                    padding: '2rem',
                    textAlign: 'left',
                    overflow: 'auto'
                }}>
                    <div style={{ maxWidth: '900px', width: '100%', border: '1px solid #1c2942', borderRadius: '8px', padding: '2rem', backgroundColor: '#101827' }}>
                        <h1 style={{ fontSize: '1.5rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertTriangle size={24} /> Application Error
                        </h1>
                        <p style={{ marginTop: '1rem', color: '#9ca3af', fontFamily: 'sans-serif' }}>A critical error occurred and the application could not start. This is not a bug in your configuration, but a programming error that needs to be fixed. Please take a screenshot of this page and send it to the developer.</p>
                        <h2 style={{ fontSize: '1.1rem', color: '#e5e7eb', marginTop: '1.5rem', borderBottom: '1px solid #1c2942', paddingBottom: '0.5rem' }}>Error Details</h2>
                        <pre style={{ 
                            marginTop: '1rem', 
                            padding: '1rem', 
                            backgroundColor: '#0a0f18', 
                            borderRadius: '4px', 
                            whiteSpace: 'pre-wrap', 
                            wordBreak: 'break-all',
                            color: '#f87171',
                            maxHeight: '20vh',
                            overflowY: 'auto'
                        }}>
                            {this.state.error?.toString()}
                        </pre>
                        <h2 style={{ fontSize: '1.1rem', color: '#e5e7eb', marginTop: '1.5rem', borderBottom: '1px solid #1c2942', paddingBottom: '0.5rem' }}>Component Stack</h2>
                        <pre style={{ 
                            marginTop: '1rem', 
                            padding: '1rem', 
                            backgroundColor: '#0a0f18', 
                            borderRadius: '4px', 
                            whiteSpace: 'pre-wrap', 
                            wordBreak: 'break-all',
                            color: '#9ca3af',
                            fontSize: '0.8rem',
                            maxHeight: '30vh',
                            overflowY: 'auto'
                        }}>
                            {this.state.errorInfo?.componentStack}
                        </pre>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
