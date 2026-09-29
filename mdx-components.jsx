import { useMDXComponents as getThemeComponents } from 'nextra-theme-docs'
import Model3D from './components/Model3DWrapper'
import OpenStemBanner from './components/OpenStemBanner'
import AssemblyGuide from './components/AssemblyGuide'

const themeComponents = getThemeComponents()

export function useMDXComponents(components) {
    return {
        ...themeComponents,
        Model3D,
        OpenStemBanner,
        AssemblyGuide,
        ...components,
    }
}
