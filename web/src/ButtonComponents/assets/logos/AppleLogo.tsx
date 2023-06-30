import React from 'react'

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="17"
      height="20"
      viewBox="0 0 17 20"
      className={className}
    >
      <g fill="none" fillRule="evenodd" stroke="none" strokeWidth="1">
        <g fill="#000" fillRule="nonzero" transform="translate(-10 -41)">
          <g transform="translate(10.75 41.5)">
            <path d="M7.96 4.385c.858 0 1.933-.58 2.573-1.353.58-.7 1.002-1.68 1.002-2.658A1.79 1.79 0 0011.5 0c-.954.036-2.102.64-2.79 1.45-.544.615-1.039 1.582-1.039 2.572 0 .145.024.29.036.338.06.013.157.025.254.025zM4.94 19c1.172 0 1.691-.785 3.153-.785 1.486 0 1.812.76 3.116.76 1.28 0 2.138-1.183 2.947-2.342.906-1.33 1.28-2.634 1.305-2.694-.085-.024-2.537-1.027-2.537-3.841 0-2.44 1.933-3.54 2.042-3.624-1.28-1.836-3.225-1.884-3.757-1.884-1.437 0-2.609.87-3.346.87-.797 0-1.848-.822-3.092-.822C2.404 4.638 0 6.595 0 10.291c0 2.295.894 4.723 1.993 6.293C2.935 17.913 3.757 19 4.94 19z"></path>
          </g>
        </g>
      </g>
    </svg>
  )
}

export default React.memo(AppleLogo)
