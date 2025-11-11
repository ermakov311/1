import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface GroupsState {
  selectedGroup: string | null;
}

const initialState: GroupsState = {
  selectedGroup: null,
};

// Создаем slice
export const groupsSlice = createSlice({
  name: 'groups',
  initialState,
  reducers: {
    setSelectedGroup: (state, action: PayloadAction<string>) => {
      state.selectedGroup = action.payload;
    },
  },
});

// Named exports для actions
export const { setSelectedGroup } = groupsSlice.actions;

// Named export для reducer
export const groupsReducer = groupsSlice.reducer; // ✅ Named export