export default function AddExistingIcon({
  fontSize,
}: {
  fontSize?: 'small' | 'medium' | 'large'
}) {
  const size = fontSize === 'small' ? 20 : fontSize === 'large' ? 28 : 24
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M12 3V13M8 9L12 13L16 9M5 13V17C5 18.1046 5.89543 19 7 19H17C18.1046 19 19 18.1046 19 17V13"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
