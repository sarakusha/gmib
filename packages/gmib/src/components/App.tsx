/*
 * Copyright (c) 2019. OOO Nata-Info
 * @author: Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { hot } from 'react-hot-loader/root';
import React, { useState, useCallback } from 'react';
import Button from '@material-ui/core/Button';

const App = () => {
  const [count, setCount] = useState(0);
  const click = useCallback(() => setCount(c => c + 1), []);
  return (
    <Button variant="contained" color="primary" onClick={click}>
      Hello World! {count}
    </Button>
  );
};

export default hot(App);
