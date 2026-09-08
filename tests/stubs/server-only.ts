// Stand-in for the `server-only` package, which intentionally throws when
// imported outside a React Server Component. Server modules under test
// import it for its build-time guarantee, not for runtime behaviour.
export {};
