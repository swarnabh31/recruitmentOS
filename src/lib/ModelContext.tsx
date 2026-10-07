import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface ModelContextType {
  models: string[];
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  refreshModels: () => Promise<void>;
}

const ModelContext = createContext<ModelContextType>({
  models: [],
  selectedModel: '',
  setSelectedModel: () => {},
  refreshModels: async () => {},
});

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');

  const refreshModels = useCallback(async () => {
    try {
      const res = await fetch('/api/ollama/models');
      const data = await res.json();
      if (data.success && data.models.length > 0) {
        setModels(data.models);
        if (!selectedModel || !data.models.includes(selectedModel)) {
          setSelectedModel(data.models[0]);
        }
      }
    } catch {
      setModels([]);
    }
  }, [selectedModel]);

  useEffect(() => {
    refreshModels();
    const interval = setInterval(refreshModels, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ModelContext.Provider value={{ models, selectedModel, setSelectedModel, refreshModels }}>
      {children}
    </ModelContext.Provider>
  );
}

export function useModel() {
  return useContext(ModelContext);
}
