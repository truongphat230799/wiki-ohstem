import { useMDXComponents as getThemeComponents } from 'nextra-theme-docs'
import Model3D from './components/Model3DWrapper'

const themeComponents = getThemeComponents()

export function useMDXComponents(components) {
    return {
        ...themeComponents,
        Model3D,
        ...components,
    }
}
