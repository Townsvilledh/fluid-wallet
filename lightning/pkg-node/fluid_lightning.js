/* @ts-self-types="./fluid_lightning.d.ts" */

class FluidNode {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FluidNodeFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_fluidnode_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    accept_peer() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.fluidnode_accept_peer(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return r0 >>> 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {string}
     */
    async_receive_offer() {
        let deferred2_0;
        let deferred2_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.fluidnode_async_receive_offer(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr1 = r0;
            var len1 = r1;
            if (r3) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(r2);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    balance() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.fluidnode_balance(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {number} height
     * @param {string} hash_hex
     * @param {string} header_hex
     */
    best_block_updated(height, hash_hex, header_hex) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val3 = +height;
            let ptr0, len0, ptr1, len1;
            try {
                ptr0 = passStringToWasm0(hash_hex, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(header_hex, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.fluidnode_best_block_updated(retptr, this.__wbg_ptr, val3, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeFromExternrefTable0(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {string}
     */
    channels() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.fluidnode_channels(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {string} channel_id
     * @param {boolean} force
     */
    close_channel(channel_id, force) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val2 = +force;
            const ptr0 = passStringToWasm0(channel_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.fluidnode_close_channel(retptr, this.__wbg_ptr, ptr0, len0, val2);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeFromExternrefTable0(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} header_hex
     * @param {number} height
     * @param {Uint32Array | number[]} indexes
     * @param {string[]} tx_hexes
     */
    confirm_transactions(header_hex, height, indexes, tx_hexes) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val4 = +height;
            let ptr0, len0, ptr1, len1, ptr2, len2;
            try {
                ptr0 = passStringToWasm0(header_hex, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passArray32ToWasm0(indexes, wasm.__wbindgen_export);
                len1 = WASM_VECTOR_LEN;
                ptr2 = passArrayJsValueToWasm0(tx_hexes, wasm.__wbindgen_export);
                len2 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr2) { wasm.__wbindgen_export5(ptr2, len2); wasm.__wbindgen_export3(ptr2, len2 * 4, 4); }
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 4, 4); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.fluidnode_confirm_transactions(retptr, this.__wbg_ptr, ptr0, len0, val4, ptr1, len1, ptr2, len2);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeFromExternrefTable0(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} pubkey
     * @param {string} host
     * @param {number} port
     * @returns {number}
     */
    connect_peer(pubkey, host, port) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val3 = +port;
            let ptr0, len0, ptr1, len1;
            try {
                ptr0 = passStringToWasm0(pubkey, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(host, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.fluidnode_connect_peer(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1, val3);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return r0 >>> 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {bigint | null | undefined} amount_msat
     * @param {string} description
     * @param {number} expiry_secs
     * @returns {string}
     */
    create_invoice(amount_msat, description, expiry_secs) {
        let deferred5_0;
        let deferred5_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val2 = BigInt.asIntN(64, (isLikeNone(amount_msat) ? BigInt(0) : amount_msat));
            const val3 = +expiry_secs;
            const ptr0 = passStringToWasm0(description, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.fluidnode_create_invoice(retptr, this.__wbg_ptr, !isLikeNone(amount_msat), val2, ptr0, len0, val3);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr4 = r0;
            var len4 = r1;
            if (r3) {
                ptr4 = 0; len4 = 0;
                throw takeFromExternrefTable0(r2);
            }
            deferred5_0 = ptr4;
            deferred5_1 = len4;
            return getStringFromWasm0(ptr4, len4);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
        }
    }
    /**
     * @param {bigint | null | undefined} amount_msat
     * @param {string} description_hash_hex
     * @param {number} expiry_secs
     * @returns {string}
     */
    create_invoice_desc_hash(amount_msat, description_hash_hex, expiry_secs) {
        let deferred5_0;
        let deferred5_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val2 = BigInt.asIntN(64, (isLikeNone(amount_msat) ? BigInt(0) : amount_msat));
            const val3 = +expiry_secs;
            const ptr0 = passStringToWasm0(description_hash_hex, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.fluidnode_create_invoice_desc_hash(retptr, this.__wbg_ptr, !isLikeNone(amount_msat), val2, ptr0, len0, val3);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr4 = r0;
            var len4 = r1;
            if (r3) {
                ptr4 = 0; len4 = 0;
                throw takeFromExternrefTable0(r2);
            }
            deferred5_0 = ptr4;
            deferred5_1 = len4;
            return getStringFromWasm0(ptr4, len4);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
        }
    }
    /**
     * @param {bigint} amount_msat
     * @param {string} description
     * @param {number} expiry_secs
     * @param {string} lsp_pubkey
     * @param {string} intercept_scid
     * @param {number} cltv_expiry_delta
     * @returns {string}
     */
    create_invoice_jit(amount_msat, description, expiry_secs, lsp_pubkey, intercept_scid, cltv_expiry_delta) {
        let deferred8_0;
        let deferred8_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val4 = BigInt.asIntN(64, amount_msat);
            const val5 = +expiry_secs;
            const val6 = +cltv_expiry_delta;
            let ptr0, len0, ptr1, len1, ptr2, len2;
            try {
                ptr0 = passStringToWasm0(description, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(lsp_pubkey, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
                ptr2 = passStringToWasm0(intercept_scid, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len2 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.fluidnode_create_invoice_jit(retptr, this.__wbg_ptr, val4, ptr0, len0, val5, ptr1, len1, ptr2, len2, val6);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr7 = r0;
            var len7 = r1;
            if (r3) {
                ptr7 = 0; len7 = 0;
                throw takeFromExternrefTable0(r2);
            }
            deferred8_0 = ptr7;
            deferred8_1 = len7;
            return getStringFromWasm0(ptr7, len7);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred8_0, deferred8_1, 1);
        }
    }
    /**
     * @param {bigint} amount_msat
     * @param {string} description_hash_hex
     * @param {number} expiry_secs
     * @param {string} lsp_pubkey
     * @param {string} intercept_scid
     * @param {number} cltv_expiry_delta
     * @returns {string}
     */
    create_invoice_jit_desc_hash(amount_msat, description_hash_hex, expiry_secs, lsp_pubkey, intercept_scid, cltv_expiry_delta) {
        let deferred8_0;
        let deferred8_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val4 = BigInt.asIntN(64, amount_msat);
            const val5 = +expiry_secs;
            const val6 = +cltv_expiry_delta;
            let ptr0, len0, ptr1, len1, ptr2, len2;
            try {
                ptr0 = passStringToWasm0(description_hash_hex, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(lsp_pubkey, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
                ptr2 = passStringToWasm0(intercept_scid, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len2 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.fluidnode_create_invoice_jit_desc_hash(retptr, this.__wbg_ptr, val4, ptr0, len0, val5, ptr1, len1, ptr2, len2, val6);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr7 = r0;
            var len7 = r1;
            if (r3) {
                ptr7 = 0; len7 = 0;
                throw takeFromExternrefTable0(r2);
            }
            deferred8_0 = ptr7;
            deferred8_1 = len7;
            return getStringFromWasm0(ptr7, len7);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred8_0, deferred8_1, 1);
        }
    }
    /**
     * @param {bigint | null | undefined} amount_msat
     * @param {string} description
     * @returns {string}
     */
    create_offer(amount_msat, description) {
        let deferred4_0;
        let deferred4_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val2 = BigInt.asIntN(64, (isLikeNone(amount_msat) ? BigInt(0) : amount_msat));
            const ptr0 = passStringToWasm0(description, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.fluidnode_create_offer(retptr, this.__wbg_ptr, !isLikeNone(amount_msat), val2, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr3 = r0;
            var len3 = r1;
            if (r3) {
                ptr3 = 0; len3 = 0;
                throw takeFromExternrefTable0(r2);
            }
            deferred4_0 = ptr3;
            deferred4_1 = len3;
            return getStringFromWasm0(ptr3, len3);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    drain_events() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.fluidnode_drain_events(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {string} user_channel_id
     * @param {string} raw_tx_hex
     */
    funding_tx_ready(user_channel_id, raw_tx_hex) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            let ptr0, len0, ptr1, len1;
            try {
                ptr0 = passStringToWasm0(user_channel_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(raw_tx_hex, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.fluidnode_funding_tx_ready(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeFromExternrefTable0(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {string}
     */
    history() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.fluidnode_history(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {string} lsp_pubkey
     * @param {string} order_id
     * @returns {string}
     */
    lsps1_check_order(lsp_pubkey, order_id) {
        let deferred4_0;
        let deferred4_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            let ptr0, len0, ptr1, len1;
            try {
                ptr0 = passStringToWasm0(lsp_pubkey, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(order_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.fluidnode_lsps1_check_order(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr3 = r0;
            var len3 = r1;
            if (r3) {
                ptr3 = 0; len3 = 0;
                throw takeFromExternrefTable0(r2);
            }
            deferred4_0 = ptr3;
            deferred4_1 = len3;
            return getStringFromWasm0(ptr3, len3);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
        }
    }
    /**
     * @param {string} lsp_pubkey
     * @param {bigint} lsp_balance_sat
     * @returns {string}
     */
    lsps1_create_order(lsp_pubkey, lsp_balance_sat) {
        let deferred4_0;
        let deferred4_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val2 = BigInt.asIntN(64, lsp_balance_sat);
            const ptr0 = passStringToWasm0(lsp_pubkey, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.fluidnode_lsps1_create_order(retptr, this.__wbg_ptr, ptr0, len0, val2);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr3 = r0;
            var len3 = r1;
            if (r3) {
                ptr3 = 0; len3 = 0;
                throw takeFromExternrefTable0(r2);
            }
            deferred4_0 = ptr3;
            deferred4_1 = len3;
            return getStringFromWasm0(ptr3, len3);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
        }
    }
    /**
     * @param {string} lsp_pubkey
     * @returns {string}
     */
    lsps1_request_options(lsp_pubkey) {
        let deferred3_0;
        let deferred3_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(lsp_pubkey, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.fluidnode_lsps1_request_options(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr2 = r0;
            var len2 = r1;
            if (r3) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(r2);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * @param {string} lsp_pubkey
     * @param {string} token
     * @returns {string}
     */
    lsps2_request_params(lsp_pubkey, token) {
        let deferred4_0;
        let deferred4_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            let ptr0, len0, ptr1, len1;
            try {
                ptr0 = passStringToWasm0(lsp_pubkey, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(token, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.fluidnode_lsps2_request_params(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr3 = r0;
            var len3 = r1;
            if (r3) {
                ptr3 = 0; len3 = 0;
                throw takeFromExternrefTable0(r2);
            }
            deferred4_0 = ptr3;
            deferred4_1 = len3;
            return getStringFromWasm0(ptr3, len3);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
        }
    }
    /**
     * @param {string} request_id
     * @param {number} menu_index
     * @param {bigint | null} [payment_size_msat]
     * @returns {string}
     */
    lsps2_select_params(request_id, menu_index, payment_size_msat) {
        let deferred5_0;
        let deferred5_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val2 = +menu_index;
            const val3 = BigInt.asIntN(64, (isLikeNone(payment_size_msat) ? BigInt(0) : payment_size_msat));
            const ptr0 = passStringToWasm0(request_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.fluidnode_lsps2_select_params(retptr, this.__wbg_ptr, ptr0, len0, val2, !isLikeNone(payment_size_msat), val3);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr4 = r0;
            var len4 = r1;
            if (r3) {
                ptr4 = 0; len4 = 0;
                throw takeFromExternrefTable0(r2);
            }
            deferred5_0 = ptr4;
            deferred5_1 = len4;
            return getStringFromWasm0(ptr4, len4);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
        }
    }
    /**
     * @param {Uint8Array | number[]} seed
     * @param {string} network
     * @param {number} tip_height
     * @param {string} tip_hash
     * @param {number} now_secs
     * @param {string} role
     */
    constructor(seed, network, tip_height, tip_hash, now_secs, role) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val5 = +tip_height;
            const val6 = +now_secs;
            let ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3;
            try {
                ptr0 = passArray8ToWasm0(seed, wasm.__wbindgen_export);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(network, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
                ptr2 = passStringToWasm0(tip_hash, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len2 = WASM_VECTOR_LEN;
                ptr3 = passStringToWasm0(role, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len3 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr3) { wasm.__wbindgen_export3(ptr3, len3 * 1, 1); }
                if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.fluidnode_new(retptr, ptr0, len0, ptr1, len1, val5, ptr2, len2, val6, ptr3, len3);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            this.__wbg_ptr = r0;
            FluidNodeFinalization.register(this, this.__wbg_ptr, this);
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {string}
     */
    node_id() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.fluidnode_node_id(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {string} pubkey
     * @param {bigint} amount_sat
     * @param {bigint} push_msat
     * @returns {string}
     */
    open_channel(pubkey, amount_sat, push_msat) {
        let deferred5_0;
        let deferred5_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val2 = BigInt.asIntN(64, amount_sat);
            const val3 = BigInt.asIntN(64, push_msat);
            const ptr0 = passStringToWasm0(pubkey, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.fluidnode_open_channel(retptr, this.__wbg_ptr, ptr0, len0, val2, val3);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr4 = r0;
            var len4 = r1;
            if (r3) {
                ptr4 = 0; len4 = 0;
                throw takeFromExternrefTable0(r2);
            }
            deferred5_0 = ptr4;
            deferred5_1 = len4;
            return getStringFromWasm0(ptr4, len4);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
        }
    }
    /**
     * @param {string} invoice
     * @param {bigint | null} [amount_msat]
     * @returns {string}
     */
    pay_invoice(invoice, amount_msat) {
        let deferred4_0;
        let deferred4_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val2 = BigInt.asIntN(64, (isLikeNone(amount_msat) ? BigInt(0) : amount_msat));
            const ptr0 = passStringToWasm0(invoice, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.fluidnode_pay_invoice(retptr, this.__wbg_ptr, ptr0, len0, !isLikeNone(amount_msat), val2);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr3 = r0;
            var len3 = r1;
            if (r3) {
                ptr3 = 0; len3 = 0;
                throw takeFromExternrefTable0(r2);
            }
            deferred4_0 = ptr3;
            deferred4_1 = len3;
            return getStringFromWasm0(ptr3, len3);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
        }
    }
    /**
     * @param {string} offer
     * @param {bigint | null} [amount_msat]
     * @returns {string}
     */
    pay_offer(offer, amount_msat) {
        let deferred4_0;
        let deferred4_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val2 = BigInt.asIntN(64, (isLikeNone(amount_msat) ? BigInt(0) : amount_msat));
            const ptr0 = passStringToWasm0(offer, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.fluidnode_pay_offer(retptr, this.__wbg_ptr, ptr0, len0, !isLikeNone(amount_msat), val2);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr3 = r0;
            var len3 = r1;
            if (r3) {
                ptr3 = 0; len3 = 0;
                throw takeFromExternrefTable0(r2);
            }
            deferred4_0 = ptr3;
            deferred4_1 = len3;
            return getStringFromWasm0(ptr3, len3);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    pending_funding() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.fluidnode_pending_funding(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    persist() {
        wasm.fluidnode_persist(this.__wbg_ptr);
    }
    /**
     * @returns {string[]}
     */
    relevant_txids() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.fluidnode_relevant_txids(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayJsValueFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} background
     * @param {number} normal
     * @param {number} high
     */
    set_fee_estimates(background, normal, high) {
        wasm.fluidnode_set_fee_estimates(this.__wbg_ptr, background, normal, high);
    }
    /**
     * @param {string[]} paths
     */
    set_sis_paths(paths) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passArrayJsValueToWasm0(paths, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            wasm.fluidnode_set_sis_paths(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeFromExternrefTable0(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} recipient_id
     * @returns {string}
     */
    sis_paths_for_recipient(recipient_id) {
        let deferred3_0;
        let deferred3_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(recipient_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.fluidnode_sis_paths_for_recipient(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr2 = r0;
            var len2 = r1;
            if (r3) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(r2);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * @param {number} conn_id
     */
    socket_closed(conn_id) {
        wasm.fluidnode_socket_closed(this.__wbg_ptr, conn_id);
    }
    /**
     * @param {number} conn_id
     * @param {Uint8Array | number[]} data
     */
    socket_data(conn_id, data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val2 = +conn_id;
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            wasm.fluidnode_socket_data(retptr, this.__wbg_ptr, val2, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeFromExternrefTable0(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} conn_id
     * @returns {Uint8Array}
     */
    take_outbound(conn_id) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.fluidnode_take_outbound(retptr, this.__wbg_ptr, conn_id);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    tick() {
        wasm.fluidnode_tick(this.__wbg_ptr);
    }
    timer_tick() {
        wasm.fluidnode_timer_tick(this.__wbg_ptr);
    }
    /**
     * @param {string} txid
     */
    unconfirm_transaction(txid) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(txid, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.fluidnode_unconfirm_transaction(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeFromExternrefTable0(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) FluidNode.prototype[Symbol.dispose] = FluidNode.prototype.free;
exports.FluidNode = FluidNode;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_string_get_7ce8eee7fd327545: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_4c88d8bf264fd984: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_broadcast_6c7b187ec1f8f8c2: function(arg0, arg1) {
            FluidLnHost.broadcast(getArrayU8FromWasm0(arg0, arg1));
        },
        __wbg_kvDel_f4c491ba04f581b5: function(arg0, arg1) {
            FluidLnHost.kvDel(getStringFromWasm0(arg0, arg1));
        },
        __wbg_kvGet_1723265904d6d6e2: function(arg0, arg1, arg2) {
            const ret = FluidLnHost.kvGet(getStringFromWasm0(arg1, arg2));
            const ptr1 = passArray8ToWasm0(ret, wasm.__wbindgen_export);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
        },
        __wbg_kvHas_b95c944aa9e3c0a7: function(arg0, arg1) {
            const ret = FluidLnHost.kvHas(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_kvKeys_6499ea947892faed: function(arg0, arg1, arg2) {
            const ret = FluidLnHost.kvKeys(getStringFromWasm0(arg1, arg2));
            const ptr1 = passArrayJsValueToWasm0(ret, wasm.__wbindgen_export);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
        },
        __wbg_kvSet_4ad6fb163de29955: function(arg0, arg1, arg2, arg3) {
            FluidLnHost.kvSet(getStringFromWasm0(arg0, arg1), getArrayU8FromWasm0(arg2, arg3));
        },
        __wbg_logMsg_f7f8e238146a439a: function(arg0, arg1) {
            FluidLnHost.logMsg(getStringFromWasm0(arg0, arg1));
        },
        __wbg_wsClose_21ed0b7d72676355: function(arg0) {
            FluidLnHost.wsClose(arg0 >>> 0);
        },
        __wbg_wsNotify_756bdf19639c9a47: function(arg0) {
            FluidLnHost.wsNotify(arg0 >>> 0);
        },
        __wbg_wsOpen_44743d3c6527b6ac: function(arg0, arg1, arg2, arg3) {
            FluidLnHost.wsOpen(arg0 >>> 0, getStringFromWasm0(arg1, arg2), arg3);
        },
        __wbindgen_generic_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            table.set(0, undefined);
            table.set(1024, undefined);
            table.set(1025, null);
            table.set(1026, true);
            table.set(1027, false);
        },
    };
    return {
        __proto__: null,
        "./fluid_lightning_bg.js": import0,
    };
}

const FluidNodeFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_fluidnode_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__wbindgen_export4();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_externrefs.get(mem.getUint32(i, true)));
    }
    wasm.__wbindgen_export5(ptr, len);
    return result;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayJsValueToWasm0(array, malloc) {
    const ptr = malloc(array.length * 4, 4) >>> 0;
    for (let i = 0; i < array.length; i++) {
        const add = addToExternrefTable0(array[i]);
        getDataViewMemory0().setUint32(ptr + 4 * i, add, true);
    }
    WASM_VECTOR_LEN = array.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__wbindgen_export6(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
cachedTextDecoder.decode();
function decodeText(bytes) {
    return cachedTextDecoder.decode(bytes);
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

const wasmPath = `${__dirname}/fluid_lightning_bg.wasm`;
const wasmBytes = require('fs').readFileSync(wasmPath);
const wasmModule = new WebAssembly.Module(wasmBytes);
let wasmInstance = new WebAssembly.Instance(wasmModule, __wbg_get_imports());
let wasm = wasmInstance.exports;
wasm.__wbindgen_start();
