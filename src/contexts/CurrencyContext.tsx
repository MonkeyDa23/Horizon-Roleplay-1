import React, { createContext, useContext, useState, useEffect } from 'react';

export type Currency = 'USD' | 'JOD' | 'SAR' | 'EGP';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  convertPrice: (priceInUsd: number) => number;
  formatPrice: (priceInUsd: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const EXCHANGE_RATES: Record<Currency, number> = {
  USD: 1,
  JOD: 0.71,
  SAR: 3.75,
  EGP: 30.90,
};

const SYMBOLS: Record<Currency, string> = {
  USD: '$',
  JOD: 'JOD',
  SAR: 'SAR',
  EGP: 'EGP',
};

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrency] = useState<Currency>('USD');

  // Load saved currency from localStorage on mount
  useEffect(() => {
    const savedCurrency = localStorage.getItem('preferred_currency') as Currency;
    if (savedCurrency && EXCHANGE_RATES[savedCurrency]) {
      setCurrency(savedCurrency);
    }
  }, []);

  // Save currency to localStorage when changed
  useEffect(() => {
    localStorage.setItem('preferred_currency', currency);
  }, [currency]);

  const convertPrice = (priceInUsd: number) => {
    return priceInUsd * EXCHANGE_RATES[currency];
  };

  const formatPrice = (priceInUsd: number) => {
    const converted = convertPrice(priceInUsd);
    const symbol = SYMBOLS[currency];
    
    // Format based on currency precision
    // JOD typically uses 3 decimal places, others 2
    const precision = currency === 'JOD' ? 3 : 2;
    
    // For RTL languages, symbol placement might differ, but standard is usually prefix or suffix
    // Let's stick to a standard format: "SYMBOL VALUE"
    return `${symbol} ${converted.toFixed(precision)}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, convertPrice, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
