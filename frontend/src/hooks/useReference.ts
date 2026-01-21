import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { Emirate, FuelBlend } from '../types/api'

// Query keys
export const referenceKeys = {
  all: ['reference'] as const,
  emirates: () => [...referenceKeys.all, 'emirates'] as const,
  fuelBlends: () => [...referenceKeys.all, 'fuel-blends'] as const,
}

// API functions
const fetchEmirates = async (): Promise<Emirate[]> => {
  const { data } = await api.get('/reference/emirates')
  return data
}

const fetchFuelBlends = async (): Promise<FuelBlend[]> => {
  const { data } = await api.get('/reference/fuel-blends')
  return data
}

// Hooks
export function useEmirates() {
  return useQuery({
    queryKey: referenceKeys.emirates(),
    queryFn: fetchEmirates,
    staleTime: 1000 * 60 * 60, // 1 hour - reference data doesn't change often
  })
}

export function useFuelBlends() {
  return useQuery({
    queryKey: referenceKeys.fuelBlends(),
    queryFn: fetchFuelBlends,
    staleTime: 1000 * 60 * 60, // 1 hour
  })
}

// Helper hooks for getting options for select components
export function useEmirateOptions() {
  const { data: emirates, isLoading } = useEmirates()

  const options = emirates?.map((e) => ({
    value: e.id,
    label: `${e.code} - ${e.name}`,
  })) || []

  return { options, isLoading }
}

export function useFuelBlendOptions() {
  const { data: fuelBlends, isLoading } = useFuelBlends()

  const options = fuelBlends?.map((f) => ({
    value: f.id,
    label: `${f.code} (${f.biodiesel_percentage}% biodiesel)`,
  })) || []

  return { options, isLoading }
}
