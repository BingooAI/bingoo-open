/**
 * @bingoo/facets — 6 TRỤC phân biệt KC (code, cố định) + luật ĐỊNH DANH phổ quát.
 * "Chất liệu" từng môn là DỮ LIỆU (DomainProfile) → hàng nghìn môn/ngành mà KHÔNG đụng code.
 * Thuần TS, không I/O.
 */
export {
  BLOOM,
  TRANSFER,
  FLUENCY,
  FACET_AXES,
  type Bloom,
  type Transfer,
  type Fluency,
  type Facets,
  type FacetAxis,
  type DomainProfile,
} from './model'
export {
  compareIdentity,
  normalizeFacets,
  facetKey,
  DEFAULT_IDENTITY_AXES,
  type IdentityVerdict,
  type IdentityResult,
} from './identity'
