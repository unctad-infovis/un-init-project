import { getFlagUrl } from '@unctad-infovis/unctad-flags';

export default function CircleFlag({ className, countryCode, height = 24, width }) {
  const size = width ?? height;
  return <img alt={countryCode.toUpperCase()} className={className} height={height} src={getFlagUrl(countryCode)} style={{ borderRadius: '50%', display: 'inline-block', height, width: size }} width={size} />;
}
