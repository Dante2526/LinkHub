export type BackgroundType = 'color' | 'gradient' | 'animated-gradient' | 'image' | 'video';
export type ButtonStyle = 'solid' | 'outline' | 'glass';
export type ButtonRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'leaf';
export type LinkFormat = 'classic' | 'featured' | 'compact' | 'minimal' | 'banner';
export type AvatarShape = 'round' | 'rounded' | 'square';
export type LinkAnimation = 'none' | 'pulse' | 'bounce' | 'shake' | 'glow';

export interface Theme {
  backgroundType: BackgroundType;
  backgroundColor: string;
  backgroundGradient: string; // e.g., 'from-pink-500 to-purple-500' or custom CSS
  backgroundImageUrl: string;
  backgroundVideoUrl: string;
  fontFamily: string;
  buttonStyle: ButtonStyle;
  buttonColor: string;
  buttonTextColor: string;
  buttonShadow: boolean;
  buttonRadius: ButtonRadius;
  linkFormat: LinkFormat;
  avatarShape: AvatarShape;
}

export interface LinkItem {
  id: string;
  title: string;
  description?: string;
  url: string;
  thumbnailUrl: string;
  isVisible: boolean;
  animation?: LinkAnimation;
}

export interface Profile {
  name: string;
  bio: string;
  avatarUrl: string;
}

export interface AppData {
  profile: Profile;
  theme: Theme;
  links: LinkItem[];
}

export const defaultTheme: Theme = {
  backgroundType: 'color',
  backgroundColor: '#f2f2f2',
  backgroundGradient: 'linear-gradient(45deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)',
  backgroundImageUrl: '',
  backgroundVideoUrl: '',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  buttonStyle: 'solid',
  buttonColor: '#ffffff',
  buttonTextColor: '#000000',
  buttonShadow: true,
  buttonRadius: 'full',
  linkFormat: 'classic',
  avatarShape: 'round',
};

export const defaultProfile: Profile = {
  name: '@seu.usuario',
  bio: 'Criador de Conteúdo | Compartilhando meus links favoritos',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
};

export const defaultLinks: LinkItem[] = [
  {
    id: '1',
    title: 'Meu Canal no YouTube',
    url: 'https://youtube.com',
    thumbnailUrl: 'https://cdn-icons-png.flaticon.com/512/1384/1384060.png',
    isVisible: true,
  },
  {
    id: '2',
    title: 'Instagram',
    url: 'https://instagram.com',
    thumbnailUrl: 'https://cdn-icons-png.flaticon.com/512/1384/1384063.png',
    isVisible: true,
  },
];
