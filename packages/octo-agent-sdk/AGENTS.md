# SDK ownership

Read README.md for public exports, example, prerequisites and acceptance. Keep root imports transport-free and wire payloads derived from the same schemas as runtime validation. Route host services only to the active branch and expected parent. Keep server policy, persistence and provider-specific code outside the package. Tests use serialized in-memory channels; never require live providers for routine verification.
