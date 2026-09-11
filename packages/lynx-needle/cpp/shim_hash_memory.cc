// Shim for std::__ndk1::__hash_memory(void const*, unsigned int) on 32-bit
// Android. The prebuilt android-armv7 needle engine references this libc++
// internal (std::hash<string> backend), which modern NDKs no longer export.
// This is the canonical libc++ 32-bit murmur2 implementation — the algorithm
// has never changed across libc++ versions, so hashes match what the engine
// objects were compiled against. Compiled only for armeabi-v7a.

#include <cstddef>
#include <cstdint>

namespace std {
inline namespace __ndk1 {

namespace {

inline uint32_t load32(const unsigned char* p) {
  // __loadword<uint32_t>: memcpy-based, little-endian on ARM.
  uint32_t r;
  __builtin_memcpy(&r, p, 4);
  return r;
}

}  // namespace

size_t __hash_memory(const void* ptr, size_t len) {
  const size_t m = 0x5bd1e995;
  const int r = 24;
  const unsigned char* data = static_cast<const unsigned char*>(ptr);
  size_t h = len;
  while (len >= 4) {
    size_t k = load32(data);
    k *= m;
    k ^= k >> r;
    k *= m;
    h *= m;
    h ^= k;
    data += 4;
    len -= 4;
  }
  switch (len) {
    case 3:
      h ^= data[2] << 16;
      [[fallthrough]];
    case 2:
      h ^= data[1] << 8;
      [[fallthrough]];
    case 1:
      h ^= data[0];
      h *= m;
  }
  h ^= h >> 13;
  h *= m;
  h ^= h >> 15;
  return h;
}

}  // namespace __ndk1
}  // namespace std
