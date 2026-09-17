// components/AuthButton.tsx
import { useAuth0 } from '@auth0/auth0-react';

export function AuthButton() {
  const { loginWithRedirect, logout, isAuthenticated, isLoading, user } = useAuth0();

  if (isLoading) {
    return <span>Cargando...</span>;
  }

  if (isAuthenticated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {user?.picture && (
          <img src={user.picture} alt={user.name} width={32} height={32} style={{ borderRadius: '50%' }} />
        )}
        <span>{user?.name}</span>
        <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() =>
        loginWithRedirect({
          authorizationParams: { connection: 'google-oauth2' },
        })
      }
    >
      Iniciar sesión con Google
    </button>
  );
}