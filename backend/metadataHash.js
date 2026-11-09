import { AbiCoder, keccak256 } from 'ethers'

const coder = AbiCoder.defaultAbiCoder()

export const EMPTY_IMAGE_HASH = keccak256('0x')

const categories = [
  'Cộng đồng',
  'Giáo dục',
  'Môi trường',
  'Y tế',
  'Sáng tạo',
  'Khác',
]

export function calculateMetadataHash({
  version = 1,
  category,
  imageHash = EMPTY_IMAGE_HASH,
} = {}) {
  if (version !== 1) {
    throw new Error('Phiên bản metadata không được hỗ trợ.')
  }

  if (typeof category !== 'string') {
    throw new Error('Thiếu chủ đề.')
  }

  const normalizedCategory = category.normalize('NFC').trim()

  if (!categories.includes(normalizedCategory)) {
    throw new Error('Chủ đề không hợp lệ.')
  }

  if (
    typeof imageHash !== 'string' ||
    !/^0x[0-9a-fA-F]{64}$/.test(imageHash)
  ) {
    throw new Error('imageHash phải là hash 32 byte.')
  }

  const encoded = coder.encode(
    ['string', 'uint256', 'string', 'bytes32'],
    [
      'CHUNG_TAY_METADATA',
      version,
      normalizedCategory,
      imageHash,
    ],
  )

  return keccak256(encoded)
}