import test from 'node:test'
import assert from 'node:assert/strict'
import { keccak256, toUtf8Bytes } from 'ethers'
import {
  calculateMetadataHash,
  EMPTY_IMAGE_HASH,
} from '../metadataHash.js'

test('Cùng dữ liệu cho cùng hash', () => {
  const first = calculateMetadataHash({
    category: 'Cộng đồng',
  })

  const second = calculateMetadataHash({
    imageHash: EMPTY_IMAGE_HASH,
    category: 'Cộng đồng',
  })

  assert.equal(first, second)
  assert.match(first, /^0x[0-9a-f]{64}$/)
})

test('Đổi chủ đề hoặc nội dung file thì hash thay đổi', () => {
  const original = calculateMetadataHash({
    category: 'Cộng đồng',
  })

  const changedCategory = calculateMetadataHash({
    category: 'Giáo dục',
  })

  const changedImage = calculateMetadataHash({
    category: 'Cộng đồng',
    imageHash: keccak256(toUtf8Bytes('noi dung file khac')),
  })

  assert.notEqual(original, changedCategory)
  assert.notEqual(original, changedImage)
})

test('Từ chối dữ liệu không hợp lệ', () => {
  assert.throws(() => calculateMetadataHash({
    category: 'Chủ đề không tồn tại',
  }))

  assert.throws(() => calculateMetadataHash({
    category: 'Cộng đồng',
    imageHash: 'abc',
  }))

  assert.throws(() => calculateMetadataHash({
    version: 2,
    category: 'Cộng đồng',
  }))
})