# Visual assets and native adapters

All 18 SVG/PNG visual assets in reference/assets match original assets from the earlier delivered customer-web or rider packages byte-for-byte. ASSET_PROVENANCE.json records each archive/member and SHA256. The logos/outlined slogan are supplied identity, not recreated live type.

The 12 product images are fictional illustrations. Use only in isolated visual fixtures or approved decorative non-SKU placements. Actual catalogue cards must display correct returned product imagery or honest missing-image placeholders. Never use a milk illustration as evidence of an actual merchant's product/stock.

CustomerReferenceIcon.tsx wraps48 fixed reference glyphs through react-native-svg, a dependency already present in the inspected customer-app package. It is a reusable source helper, not code compiled or tested in a native project here. Retain exact glyph geometry and size/stroke overrides while allowing larger invisible accessible touch targets.

The caller supplies a trusted theme color; XML attribute values are escaped. A bundled icon map is not permission to load arbitrary untrusted remote SVG markup. Accessibility names/roles belong to the surrounding native controls where appropriate.

Font binaries are not included. The brand lettering is outlined in supplied artwork; body typography uses the intended project font setup. Current browser capture observed Inter on the hero. LAYOUT_MEASUREMENTS.json gives computed browser values, not platform-independent guarantees.
