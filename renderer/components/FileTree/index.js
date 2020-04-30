import React, { useState, useCallback } from "react";
import { Button } from "antd";

import ConfigChooseModal from "./ConfigChooseModal";
import OwnDirectoryTree from "./OwnDirectoryTree";

export default function FileTree() {
  const [modalShown, setModalShown] = useState(false);
  const openModal = useCallback((e) => {
    e.target.blur();
    setModalShown(true);
  }, []);
  const closeModal = useCallback(() => setModalShown(false), []);

  return (
    <>
      <Button
        block
        style={{ overflowX: "hidden", textOverflow: "ellipsis" }}
        onClick={openModal}
      >
        新建一个负载配置
      </Button>
      <br />
      <ConfigChooseModal visible={modalShown} closeModal={closeModal} />
      <OwnDirectoryTree />
    </>
  );
}
