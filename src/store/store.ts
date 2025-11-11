import { configureStore } from '@reduxjs/toolkit';
import { groupsReducer } from './groups/groupsSlice';
import { projectReducer  } from './project/projectSlice'; // Импортируем новый reducer

export const store = configureStore({
  reducer: {
    groups: groupsReducer, 
    project: projectReducer ,  
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;