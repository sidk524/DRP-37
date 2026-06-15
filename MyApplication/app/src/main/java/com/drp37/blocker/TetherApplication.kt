package com.drp37.blocker

import android.app.Application
import com.drp37.blocker.local.TetherLocalStore
import com.drp37.blocker.accountability.AccountabilityNotifier

class TetherApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        TetherLocalStore.init(this)
        AccountabilityNotifier.init(this)
    }
}
