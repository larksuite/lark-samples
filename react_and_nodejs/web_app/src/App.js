// import useAuthentication from './client/use-authentication';
import React from 'react';
import useFreeLogin from './client/use-free-login';
import './App.css';

function App() {
  // const { userInfo } = useAuthentication();
  const { userInfo } = useFreeLogin();

  return (
    <div className="App">
      <header className="App-header">
        <img src={userInfo.avatar} className="App-logo" alt="logo" />
        <p>
          {userInfo.name}
        </p>
      </header>
    </div>
  );
}

export default App;
