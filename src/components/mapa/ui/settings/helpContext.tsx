import { createContext, useContext } from 'react';

export const HelpVisibilityContext = createContext(false);
export const useHelpVisible = () => useContext(HelpVisibilityContext);
