// components/AuthButton.tsx
import { useAuth0 } from '@auth0/auth0-react';

export function AuthButton() {
  const { loginWithRedirect, logout, isAuthenticated, isLoading, user } = useAuth0();

  if (isLoading) {
    return <span className="auth-button__loading">Cargando...</span>;
  }

  if (isAuthenticated) {
    return (
      <div className="auth-button auth-button--session">
        {user?.picture && (
          <img className="auth-button__avatar" src={user.picture} alt={user.name} width={32} height={32} />
        )}
        <span className="auth-button__name">{user?.name}</span>
        <button
          className="auth-button__action auth-button__action--logout"
          onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <button
      className="auth-button__action auth-button__action--login"
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